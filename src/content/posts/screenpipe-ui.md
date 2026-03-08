---
title: "Building screenpipe-ui: A Community UI for Your AI Screen Memory"
date: 2026-03-08
description: "How I built a CLI, TUI, and web interface for screenpipe—sharing architecture decisions, publishing gotchas, and the framework-agnostic core design."
tags: ["tools", "typescript", "react", "cli"]
draft: false
---

# Building screenpipe-ui: A Community UI for Your AI Screen Memory

[screenpipe](https://github.com/screenpipe/screenpipe) turns your computer into a personal AI that knows everything you've done—screen captures, audio transcriptions, UI state—all local, all private. It's a powerful backend with 17k+ GitHub stars. What it didn't have, until recently, was a polished way to search and browse that memory from the terminal or the browser.

That's what [screenpipe-ui](https://github.com/remoun/screenpipe-ui) is: a community-built, open-source interface to screenpipe. Three interfaces, one codebase.

---

## Three Interfaces, One Codebase

**CLI** — Quick terminal commands for power users and scripts:

```bash
bunx @screenpipe-ui/cli search "meeting notes" --type audio --limit 10
bunx @screenpipe-ui/cli health
bunx @screenpipe-ui/cli activity --today
```

**TUI** — An interactive terminal app built with Ink (React for terminals). Tab between Search, Timeline, and Meetings. Use `j`/`k` to navigate, Enter to expand a result and read the full transcript.

**Web** — A Vite + React + Tailwind SPA for the browser. Run it from the repo with `bun web`, build it, and deploy to Vercel or Netlify.

All three share the same core: business logic, state management, and formatting live in a framework-agnostic `@screenpipe-ui/core` package. The CLI calls it directly for instant startup. The TUI and Web both use React (Ink is just a React renderer for terminals) and share hooks via `@screenpipe-ui/react`. That shared architecture means search, health checks, and activity views behave the same everywhere.

---

## Architecture: Framework-Agnostic by Design

A key decision was using **Zustand vanilla stores** (`createStore()`, not `create()`). The CLI doesn't load React at all—it uses `.getState()` imperatively. The TUI and Web subscribe via `useSyncExternalStore`, so they stay reactive. One store, multiple consumers.

The client is a custom `ScreenpipeUIClient` with raw `fetch`. The published `@screenpipe/js` SDK is aimed at pipes and plugins, not external apps, so we built a thin REST client that fits our needs.

---

## The Development Journey

Building screenpipe-ui involved a lot of iteration. Some of it was feature work; a lot of it was polish and tooling.

### Making the TUI Usable

Early on, the TUI truncated search results. You couldn't see the full contents of a transcript. We added Enter to open a detail view—simple, but it made the TUI actually useful for reading. Another fix: the type filter (OCR vs. audio) didn't update the result list until you ran a new search. Now it reflects immediately.

### Base URL Everywhere

Users run screenpipe on custom hosts and ports. The CLI had `--url`, but the TUI and Web always hit `localhost:3030`. We unified this:

- **CLI**: `--url` or `SCREENPIPE_BASE_URL`
- **TUI**: `--url` or `SCREENPIPE_BASE_URL`
- **Web**: `?url=` query param or `SCREENPIPE_BASE_URL` (via Vite `define`)

We extracted base URL resolution into pure, testable functions so we could exercise this logic in tests. Environment overrides are easy to simulate: set `process.env`, run the code, restore it.

### Publishing to npm: The workspace:* Gotcha

The packages use Bun workspaces with `workspace:*` for internal dependencies. npm doesn't support that protocol. When users ran `npx @screenpipe-ui/tui`, they hit:

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

The fix: use `bun pm pack` before `npm publish`. Bun produces tarballs with `workspace:*` resolved to real versions. npm never sees the protocol. We kept `npm publish` for [Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements) (OIDC)—no long-lived tokens—and learned to run `bun update` whenever we bump versions so the lockfile stays in sync.

### CI/CD: Trusted Publishing and Gated Releases

We set up a GitHub Actions workflow that publishes when the version changes. Only when the version field changes in `package.json`—not on every dependency update. A small check job compares the current version to the previous commit; if unchanged, we skip publish entirely.

We use an **npm Environment** with required reviewers. Pushes to `main` trigger the workflow, but it waits for approval before publishing. Good for when version bumps land via PR and you don't want every merge to auto-publish.

After a successful publish, the workflow creates and pushes a tag (e.g. `v0.1.4`). Release history stays tidy.

To iterate on the workflow without bumping versions, we included `.github/workflows/publish.yml` in the trigger paths. Pushes that only change the workflow file will run the check job—which will skip publish—so you can test the pipeline safely.

---

## Why the Web Package Is Private

The CLI and TUI are tools you install and run; they're published to npm. The Web package is a Vite SPA that builds to static HTML/JS/CSS. It's meant to be run from the repo, built, and deployed to a static host—not `npm install`ed. Marking it `private: true` avoids accidental publishes and matches that usage. The published CLI and TUI packages mention the web UI in their descriptions and READMEs so users know it exists.

---

## Testing and Contribution

We require tests for all changes—new behavior, bug fixes, and refactors. Tests live per package in `__tests__` or `*.test.ts`. Before any PR, `bun test --recursive` must pass. It's in the README and in our agent guidelines.

---

## Try It

Requires [screenpipe](https://github.com/screenpipe/screenpipe) running locally (default port 3030).

```bash
# CLI
bunx @screenpipe-ui/cli search "your query"
bunx @screenpipe-ui/cli health

# TUI
bunx @screenpipe-ui/tui

# Web (from source)
git clone https://github.com/remoun/screenpipe-ui
cd screenpipe-ui && bun install && bun web
```

Custom server? Use `--url` or `SCREENPIPE_BASE_URL` (or `?url=` for the web app).

---

screenpipe-ui is [MIT licensed](https://github.com/remoun/screenpipe-ui/blob/main/LICENSE.md) and open for contribution. If you use screenpipe and want a better way to search and browse your memory, give it a try.
