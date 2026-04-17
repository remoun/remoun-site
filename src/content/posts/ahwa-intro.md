---
title: 'Ahwa: A table for the hard decisions'
description: 'Open WebUI gave me a playground for personas one at a time. Ahwa lets them argue together — a self-hosted council of personas that deliberates on one dilemma, synthesizes, and gets out of the way.'
date: 2026-04-16
tags: [ai, self-hosting, yunohost, docker, sveltekit, typescript, open-source]
---

I wrote last month about [packaging Open WebUI for YunoHost](/self-hosting-ai-chat). That gave me the playground I wanted: a single surface where I could wire up different providers, save personas, and experiment freely. Good for drafting, good for rubber-ducking, good for building a writing coach who actually pushes back.

But the decisions that actually matter aren't drafting problems. They're the ones where a part of me says yes and another part says no, and I don't know which part to trust. Should I take the job. Should I say the hard thing to the friend. Should I keep going on this project, or put it down.

One persona at a time can't help with that. I wanted a council.

---

## What Ahwa is

**Ahwa** (_قهوة_, Egyptian Arabic for coffee / coffeehouse) is a self-hosted deliberation tool. You pose a dilemma; a small council of personas argues it out across a few rounds; a synthesizer reads the whole debate and gives you a plain-language recommendation. Then it gets out of the way.

The default council has five voices:

- **The Elder** — what would your 60-year-old self thank you for, or regret.
- **The Mirror** — are you drifting from your own stated values.
- **The Engineer** — what are the constraints, the second-order effects, the leverage points.
- **The Weaver** — who else is affected, whose voice is missing.
- **The Instigator** — would you rather, in five years, tell the bolder story.

You can fork the council, write new personas, pick different models per council, drop in a community-contributed "Relationship Anarchist Council" or "DSA Praxis Council." The app is AGPL, ships zero telemetry, and runs as a single binary or Docker image on any box you already have.

---

## The shape of M1

I time-boxed M0 to a checkpoint: prove the invariants hold in real code before investing in scaffolding. Once that worked — one deliberation, one table, typed SSE events from server to UI — M1 was "turn this into something a technically comfortable friend can self-host in 15 minutes."

That meant: table history, council CRUD, a Markdown export, four providers (Anthropic / OpenAI / OpenRouter / Ollama), Docker packaging, and a preview-deploy pipeline so I could actually hit the thing from my phone.

The interesting parts, again, were the things that broke.

### The silent empty-response trap

Early on, I deployed a preview build to Fly and created a table. The UI rendered each persona card, the synthesizer finished, "Deliberation complete." showed up. Every turn was empty.

The server wasn't erroring. The orchestrator was happily iterating the async stream from the provider, collecting zero tokens, marking the turn complete, persisting empty text, moving on. The UI had no way to know.

The fix was a one-line guard in the orchestrator — but the commit message was the lesson:

```ts
if (fullText === '') {
  throw new Error(
    `LLM returned empty response for ${persona.name} ` +
      `(provider: ${resolvedConfig.provider}, model: ${resolvedConfig.model}). ` +
      `Check provider credentials and model availability.`,
  );
}
```

> A provider that closes the stream without yielding anything is almost always a silent failure (rate-limit, bad model id, dead connection) rather than a model legitimately choosing to say nothing.

Once that was in place, I hit the real cause: my default OpenRouter model (`meta-llama/llama-3.1-8b-instruct:free`) had been rate-limited into uselessness. Free-tier model IDs rotate. I moved the default to an NVIDIA Nemotron variant — NVIDIA subsidizes those to showcase NIM, so availability is steadier — and the symptom came back useful: if _that_ one gets retired, the error now names the provider and model instead of pretending everything is fine.

### Ollama as an "always available" fallback wasn't

The same class of bug, one level up. My `detectDefaultProvider()` used to return `ollama` when no API key was set — the reasoning being "Ollama is local, no key needed, always there as a fallback." Except on a hosted VPS there is no local Ollama, and every call failed silently into the empty-response trap above.

I changed it to only pick Ollama when `OLLAMA_BASE_URL` is set explicitly, and to throw on startup otherwise with a message naming the four env vars that would satisfy it. One commit smaller, surprising-behavior-free.

### Red-green as a forcing function

This project is built largely by voice. I'm recovering from eye surgery and can't stare at a screen for long; the working loop is "describe the spec, let the agent write the test, run the test, confirm it fails for the right reason, write the code, confirm green, commit."

I've long subscribed to the view that tests are executable documentation — they're how someone new to a codebase learns what the system does and doesn't do. But in practice, strict TDD often felt like writing the same thing twice. With Claude doing the mechanical work, the friction disappears: the test is the spec stated as observable behavior, the agent writes both the test and the implementation, and I just confirm red then green by voice. It's both easier to develop and easier to maintain — the documentation stays current because it's the thing that drives the code into existence.

The `CLAUDE.md` that governs the agent now has this line:

> Adding tests _after_ the code has shipped is the anti-pattern this rule exists to prevent — if you find yourself doing that, treat it as a bug in your process, not a neutral alternative.

The day I slipped and let a commit land with the tests written after, the commit after was "call out my own slip in CLAUDE.md so it doesn't happen again." The agent and I have the same rulebook now.

### A theme system without a webfont

Zero telemetry is a product promise. That means no Google Fonts, no analytics, no crash reporter — not even anonymous. For typography I wanted a warm humanist serif on headings to lean into the coffeehouse metaphor, but I didn't want to ship a webfont.

Modern CSS solved it twice over. For the palette, `light-dark()` collapses ~75 lines of duplicated dark-mode overrides into one declaration per token:

```css
:root {
  color-scheme: light dark;
  --c-bg: light-dark(#f8fbff, var(--color-slate-950));
  --c-surface: light-dark(var(--color-white), var(--color-slate-900));
  /* ...one line per token... */
}
:root.light { color-scheme: light; }
:root.dark { color-scheme: dark; }
```

For the serif, a system-font stack ships with the OS:

```css
--font-display:
  Charter, 'Iowan Old Style', 'Palatino Linotype', Palatino,
  'URW Palladio L', 'Hoefler Text', Georgia, Cambria, serif;
```

No bytes on the wire, no font-loading flash, no third-party request. Charter on macOS/iOS, Palatino on Linux/Windows, Georgia as the broad fallback. The zero-telemetry promise holds and the thing still feels like an intellectual object rather than a SaaS form.

---

## Where I'm headed

M2 adds a public demo at `ahwa.app` for people who want to try before they install — rate-limited, ephemeral, walled off from any memory feature — and a proper YunoHost package so the install path mirrors the Open WebUI one. M3 is the milestone I most want to write and most fear committing to: per-party **memory** (a markdown file per party, passed to every persona as context, editable by you), **two-party mediation** (one link per participant, each talks to the council privately, the synthesizer sees both sides), and a persona called **The Historian** who only becomes available once memory exists and whose job is to notice patterns across time.

For now, M1 has shipped and is running at https://ahwa.app. The code is [on GitHub](https://github.com/remoun/ahwa). Try it if you want a council around your own table.
