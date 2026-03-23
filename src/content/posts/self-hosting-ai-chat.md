---
title: "Self-hosting my AI chat playground"
description: "Why I packaged Open WebUI for YunoHost — and what I learned about building a personal space to experiment with AI personas."
date: 2026-03-22
tags: [ai, self-hosting, yunohost, open-source]
---

I use Claude about daily nowadays. It's great. But I wanted something it doesn't offer: a single interface where I can wire up different providers, create custom personas, and experiment freely — all on my own server.

That's what led me to [Open WebUI](https://github.com/open-webui/open-webui) and, eventually, to packaging it for [YunoHost](https://yunohost.org).

---

## What I actually wanted

A playground. Somewhere I could:

- **Create custom bots** with specific system prompts and model configurations — a writing coach, a code reviewer, a brainstorming partner, each tuned differently
- **Mix providers** — route some conversations through OpenRouter, others through a local Ollama instance, and swap freely
- **Own the whole stack** — my data, my prompts, my models, no one else's terms of service

Open WebUI does all of this. It's a polished chat interface that speaks to Ollama and any OpenAI-compatible API. It supports custom "models" (really persona definitions: a name, a system prompt, a backing model), conversation history, RAG, and more. Think of it as a self-hosted ChatGPT where you control the wiring.

The missing piece was getting it running cleanly on my YunoHost server — with LDAP, SSO, proper logging, and the kind of install/upgrade/backup lifecycle YunoHost expects.

---

## Why YunoHost

I run my personal infrastructure on a single VPS with [YunoHost](https://yunohost.org). It handles domains, certificates, user accounts, LDAP, SSO, backups — the boring stuff that I don't want to think about. When I want to add a service, I install a YunoHost app. When I want to remove it, I uninstall it. Everything stays consistent.

The catch: Open WebUI didn't have a YunoHost package. So I built one.

---

## The packaging journey

YunoHost packaging is its own discipline. You write bash scripts for install, upgrade, remove, backup, restore, and change-url. You define a manifest with install questions, resource requirements, and integration metadata. You wire up systemd, nginx, and whatever database your app needs.

The interesting parts were the things that broke.

### Startup detection

YunoHost's installer needs to know when your app is ready. The standard approach: tail the log for a specific string like "Uvicorn running on..." and wait.

Open WebUI made this surprisingly hard. Uvicorn binds the port and starts serving HTTP *before* it finishes its startup lifecycle. The "Uvicorn running" message goes to stderr while the app logs go to stdout. And on first launch, the app downloads an embedding model that can take 30+ minutes on a modest VPS.

The fix was simple once I understood the problem: skip log matching entirely and just poll the HTTP port.

```bash
wait_for_port() {
    local port="$1"
    local timeout="${2:-120}"
    local i=0
    while [ "$i" -lt "$timeout" ]; do
        curl -s -o /dev/null "http://127.0.0.1:$port/" && return 0
        sleep 5
        i=$((i + 5))
    done
    return 1
}
```

### The embedding model problem

Open WebUI ships with local RAG support using sentence-transformers. On first start, it downloads a ~90MB model. That's fine in a Docker container where you control the build. In a YunoHost install script with a timeout, it's a problem.

The fix: default the embedding engine to `openai` so the app starts instantly without downloading anything. Users can always switch to local embeddings later through the admin panel.

### Authentication: SSO or open registration

YunoHost manages users via LDAP and provides SSO through HTTP headers. Open WebUI supports both. But I realized not every install needs the same auth model — sometimes you want to lock it down to YunoHost users, sometimes you want to let anyone create an account.

So the installer asks: **SSO mode** (LDAP + trusted headers, only YunoHost users can log in) or **open registration** (Open WebUI manages its own accounts, anyone can sign up). One question at install time, and the right `.env` values get wired up.

### Yanked dependencies and masked errors

The most educational failure came after everything was "working." I bumped Open WebUI to 0.8.10 and the install broke: `ddgs==9.11.2` had been yanked from PyPI. OK, pin to 0.8.8 instead. But 0.8.8 crash-looped on startup — a bug in its database migration code where a `finally` block referenced a variable that was never assigned if the connection failed, masking the real error with an `UnboundLocalError`.

The fix was to go back to 0.8.10, install it with `--no-deps`, patch the package metadata to accept a newer ddgs, then let pip resolve everything else normally. It's the kind of thing that only surfaces when you're installing from PyPI on a real server instead of pulling a pre-built Docker image.

---

## Where I'm headed

The package works. I can install Open WebUI on any YunoHost server with `yunohost app install`, and it handles upgrades, backups, and multi-user access out of the box.

Now comes the fun part: building the personas. A writing editor that pushes back on weak arguments. A coding partner that knows my stack. A brainstorming agent that's deliberately contrarian. Each one a different model, a different prompt, a different personality — all accessible from one chat interface on my own server.

The package is [on GitHub](https://github.com/remoun/openwebui_ynh) if you want to try it. You'll need a YunoHost server and optionally an Ollama instance or an OpenAI-compatible API key.

---

Self-hosting AI tools isn't about replacing the hosted services. It's about having a space to experiment — your models, your prompts, your rules.
