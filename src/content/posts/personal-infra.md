---
title: "Building my personal infrastructure in an afternoon"
description: "From buying remoun.* to a fully deployed multi-domain site in a few hours."
date: 2025-12-24
tags: [meta, astro, cloudflare, ai]
---

Yesterday morning I bought a bunch of `remoun.*` domains. By evening, I had a fully deployed personal infrastructure: blog, landing page, URL shortener, and a separate dating page — all from one repo.

The whole thing took an afternoon. And it was surprisingly fun!

## What I wanted

- **remoun.dev** — A landing page and professional hub
- **remoun.blog** — A place to document hacks and other writings worth sharing
- **remoun.to** — A personal URL shortener (remoun.to/gh → GitHub, etc.)
- **remoun.love** — A date-me doc with its own vibe, separate from the professional stuff

I didn't want to maintain multiple repos or deployments. I wanted to write Markdown in my editor, push, and be done. And I wanted the option to edit from my phone when inspiration struck.

## The stack

- **Cloudflare Pages** — Hosting, automatic deploys from GitHub
- **Astro** — Static site generator, content collections for blog posts and portfolio items
- **Novel** - Notion-style WYSIWYG editor with AI-powered autocomplete
