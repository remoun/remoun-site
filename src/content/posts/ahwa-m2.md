---
title: 'Ahwa M2: a public demo and a YunoHost installer'
description: 'The demo at ahwa.app is open; the YunoHost package is in. Two stories from getting there: the silent demo-budget leak a reviewer caught, and the LDAP sudo rule that quietly defeated every NOPASSWD file I dropped on the runner box.'
date: 2026-04-18
draft: true
tags: [ahwa, ai, self-hosting, yunohost, sveltekit, typescript, open-source]
---

I [wrote about Ahwa](/ahwa-intro) when M1 shipped — the council, the synthesizer, the metaphor, the bugs. Two pieces of M2 are now landed:

1. **A public demo at [ahwa.app](https://ahwa.app)**. Rate-limited, ephemeral, a fixed three-persona council, the cheapest model that produces nuanced output. Type a dilemma and watch a council argue. Tables auto-delete in 24 hours. No login.
2. **A YunoHost package**: [github.com/remoun/ahwa_ynh](https://github.com/remoun/ahwa_ynh). One-line install on any YunoHost box; SSO works through SSOwat with no in-app auth code. Catalog submission is in flight; until that lands, install from the URL directly.

The interesting parts, again, were the things that broke.

---

## The pre-charge race the reviewer found

Demo mode is supposed to do two things to keep ahwa.app's bill bounded: rate-limit per IP (so a script can't fire 1000 demos a minute), and cap total tokens per UTC day (so a popular Hacker News morning doesn't drain the OpenRouter wallet by lunch).

The cap is the harder one. Demos take real wall-clock time — the council argues for 30-60 seconds, tokens flow gradually, the actual cost isn't known until the deliberation ends. The naive design is "check the cap before starting, record actuals after." That has a window: between check and record, N other demos can also pass the check, and now you've blown the cap by N × estimate.

I went with **atomic pre-charge plus reconcile**. At request time, debit an estimated 5K tokens against today's bookkeeping inside a single SQLite transaction — so the check and the debit can't be split across a race. After the deliberation closes with the actual token count, apply `(actual − estimate)` to refund the over-charge or catch up an under-estimate.

The tests for that landed clean. PR review caught the actual bug.

A code-review agent [pointed out](https://github.com/remoun/ahwa/pull/28) that the orchestrator throws on LLM errors (rate limits, network blips, mid-stream aborts) without yielding the `table_closed` event. My reconcile wrapper only fired on `table_closed`. So when a demo failed, the pre-charge stayed debited forever. Repeated failures would silently bleed the daily cap to zero against work that produced nothing.

The fix is a `try { ... } finally { ... }` that distinguishes three end-states:

- Normal close with a token count → reconcile to actuals.
- Close *without* a token count (a mock or a provider that doesn't surface usage) → keep the pre-charge as a conservative estimate.
- Source ended without a close (threw, aborted, signal cancellation) → refund the full pre-charge.

```ts
try {
  for await (const event of source) {
    if (event.type === 'table_closed' && typeof event.totalTokens === 'number') {
      reconcile(event.totalTokens);
    }
    yield event;
  }
} finally {
  // Source threw or was cancelled — refund actualTokens=0.
  if (state === 'pending') reconcile(0);
}
```

Three reviewers flagged variants of the same root cause independently. Multi-agent review earns its keep on cross-cutting bugs that look fine in isolation. The `yield` was inside the loop, the reconcile was inside the loop, the throw exited the loop — each piece was correct, the composition wasn't.

---

## The LDAP sudo rule that ate every NOPASSWD I dropped

The YunoHost package needs CI. The official YNH `package_check` script spins up a fresh YunoHost in an LXC container and runs `install`, `remove`, `upgrade`, `backup`, `restore` against it. That requires `lxd` privileges plus root inside the container, which means it can't run on GitHub-hosted runners (no nested LXC). The standard pattern is a self-hosted runner on a YunoHost box.

I have a YunoHost VPS. Registering a runner there was straightforward. Making `sudo yunohost ...` work non-interactively from the runner — that ate an afternoon.

First attempt: drop `/etc/sudoers.d/yunohost-remoun` with `remoun ALL=(root) NOPASSWD: /usr/bin/yunohost`. Test: `sudo -n yunohost --version` → `sudo: a password is required`.

Why? Looked at `sudo -ln`:

```
User remoun may run the following commands on remoun:
    (root) NOPASSWD: /usr/bin/yunohost
    (root) ALL
```

There's a `(root) ALL` rule (no NOPASSWD) appearing *after* my NOPASSWD entry. Sudo's "last match wins" — `(root) ALL` won, password required. Where was that rule coming from?

Grepping `/etc/sudoers` and `/etc/sudoers.d/` for `remoun`, `admins`, `%sudo` turned up `%sudo ALL=(ALL:ALL) ALL` at line 50 of `/etc/sudoers`. Modified that to add `NOPASSWD:` — same result.

Tried `sudo -lU remoun -ll` (the verbose form):

```
LDAP Role: admins
    RunAsUsers: root
    Commands: ALL
```

There it is. YunoHost's `admins` LDAP role grants `(root) ALL`, sourced from LDAP, evaluated *after* file-based sudoers. No file rule can override it via ordering — it's a different evaluation pass.

The fix that actually works is a per-user `Defaults`:

```
Defaults:remoun !authenticate
```

Per-user `Defaults` apply globally for the named user regardless of which rule matched. LDAP role still grants the right; the `!authenticate` clause skips the password prompt. One line. Documented because nobody else should have to find this.

Once it worked, I realized I'd built exactly the wrong thing: every command (not just `yunohost`) was passwordless for `remoun`. If someone got my SSH key, they had `sudo rm -rf /` for free. The right design is a *dedicated user* — call it `gha-runner` — that owns the runner, scoped to one binary:

```
gha-runner ALL=(root) NOPASSWD: /usr/bin/yunohost
```

This rule grants the right *and* the NOPASSWD, all on one line, without needing a `Defaults` to reach over the LDAP rule (because the rule itself grants the access — LDAP isn't load-bearing for a user that LDAP doesn't know about). My personal account goes back to "every sudo asks for the password," which is what I wanted in the first place.

---

## The permission flip I built and then deleted

The YNH package needed an end-to-end SSO assertion — install Ahwa, log in via SSOwat, hit `/api/me`, confirm the resulting party row got the SSOwat user as its `external_id`. The lifecycle harness `package_check` exercises install/remove/upgrade/backup/restore but its `tests.toml` schema is closed: no hook for custom assertions. So the SSO check needed to live as its own job.

The deploy default was `init_main_permission=visitors` — anyone with the URL gets through, no SSO interception. Reasonable for iterative `make deploy` work because the SSO header is irrelevant when you're poking the app directly. So `make sso-test` flipped the permission to `all_users` (SSOwat intercepts → sets `Auth-User`), ran the assertion, flipped back. A wrapper script, `tests/run-sso-test.sh`, owned the dance.

That worked once. Then YNH 12 broke it. The old syntax —

```
yunohost user permission update <perm> --add all_users --remove visitors
```

— now returns `unrecognized arguments: --remove visitors --add all_users`. YNH 12 split the operation into separate subcommands (`permission add` / `permission remove`). I fixed the wrapper to call them one at a time.

Then the right question landed: *why do we set the permission at all?*

Right answer: stop doing both. Make `init_main_permission=all_users` the deploy default. SSOwat then intercepts on every install — which is closer to how a real user runs the app — and the wrapper script becomes deletable. The single-config-knob that nobody has to think about beats two scripts that flip the knob back and forth.

Net of the refactor: -49 lines, including the entire wrapper and a paragraph of CONTRIBUTING.md about when the flip mattered. The lesson, as usual: when you're about to add code to compensate for a default, change the default first. The fix that deletes code is the one that ships.

---

## A small thing I'm pleased with: one bash script, two callers

The SSO assertion lives in [`tests/sso-e2e.sh`](https://github.com/remoun/ahwa_ynh/blob/main/tests/sso-e2e.sh) — a ~60-line bash script with no harness, no test framework, no fixtures. It POSTs to the YNH portal login endpoint to get a session cookie, hits `/api/me` with that cookie, parses `external_id` out of the response without `jq`, asserts.

Two callers run it identically:

- **From the Mac**, `make sso-test` reads `AHWA_TEST_USER` and `AHWA_TEST_PASSWORD` from the shell and invokes the script against the live VPS install.
- **From CI**, the same secrets come from GitHub repo secrets via env, and the script runs against the same live VPS install on a self-hosted runner.

No port to a different test runner. No "works locally, fails in CI" gap to debug. The same bytes execute in both places.

The script doubles as a working SSO debugging tool — when somebody self-hosting reports "headers aren't reaching the app," I can hand them the script and they can run it against their own install. Local, CI, user-debugging-their-box: three contexts, one script.

There's no clever framework underneath. POSIX shell, curl, sed. The whole thing reads in a minute and modifies in five. That's the property I want from any check that gates a deploy.

---

## A small thing I'm pleased with: `.bun-version` as single source of truth

Bun pins live in three places: the Dockerfile (`FROM oven/bun:1.3.12`), the YunoHost install script, and CI's `setup-bun` action. All three drifting independently is a class of bug nobody notices until a weird production-only failure that the local dev environment can't reproduce.

`.bun-version` at the repo root is the canonical pin. The YNH install script does `cat $install_dir/src/.bun-version`. The Dockerfile takes `ARG BUN_VERSION` and CI passes `--build-arg BUN_VERSION=$(cat .bun-version)`. The `setup-bun` composite action reads it directly. Bumping the file in one PR updates every deployment path.

Small thing. But it's the kind of small thing that, once it exists, you stop thinking about — and the thinking-about was the whole problem.

---

## Where I'm headed

M2 is essentially complete: demo + landing page + YNH packaging are merged, and the production demo at [ahwa.app](https://ahwa.app) is what to play with first if you're curious. Catalog submission is the last small piece.

M3 is the next milestone: per-party **memory** (a markdown file per party, passed to every persona as context, editable by you), **two-party mediation** (one link per participant, each talks to the council privately, the synthesizer sees both sides), and a persona called **The Historian** who only becomes available once memory exists and whose job is to notice patterns across time — your patterns, with consent, in a file you own.

If you want to try the demo, [ahwa.app](https://ahwa.app) is live now. If you want a council around your own table — your dilemmas, your API keys, your machine — install via [Docker](https://github.com/remoun/ahwa#install-via-docker) or the new [YunoHost package](https://github.com/remoun/ahwa_ynh). Both are in [the Ahwa repo](https://github.com/remoun/ahwa) (AGPL, zero telemetry, [the usual promises](/ahwa-intro)).

[All Ahwa posts →](/tag/ahwa)
