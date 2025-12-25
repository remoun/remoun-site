# Remoun Site - Claude Code Context

## Repository Overview

This is an Astro-based personal site covering:
- Blog posts (`src/content/posts/`)
- Portfolio/projects (`src/content/projects/`)
- Short URL redirects
- Tools and interactive pages

Deployed to Cloudflare Pages at remoun.me (with remoun.blog, remoun.dev, etc. as aliases).

## Blog Writing Voice

### Tone
- First person, conversational but not casual
- Technically competent without showing off
- Self-aware about privilege without performative guilt
- Concrete examples over abstract principles
- Show the thinking process, not just conclusions

### Structure
- Start with a hook grounding readers in the problem
- Use headers sparingly—only for real section breaks
- End with something actionable or a question
- Keep paragraphs short (2-4 sentences)
- Target 800-1200 words for most posts

### Avoid
- Humblebragging ("I know I'm so lucky, but...")
- Lecturing readers about what they should do
- Excessive hedging/qualifiers
- Starting paragraphs with "So," or "Now,"
- Neat bows at the end—leave some threads open

### When writing about money/privilege
- Acknowledge it directly, briefly, once—then move on
- Focus on the intellectual/philosophical content
- Make it useful regardless of reader's situation
- Don't apologize repeatedly; reads as insincere

## Code Style

### Astro/Frontend
- Minimal dependencies; prefer native solutions
- Tailwind for styling
- TypeScript for type safety in content collections
- Keep components small and focused

### Interactive Tools (React)
- Use recharts for data visualization
- Include presets/examples so users can explore without entering their own data
- Always add assumptions/caveats sections
- Make tools genuinely useful, not just demos

## Content Collections

Posts frontmatter:
```yaml
---
title: "Post Title"
date: 2025-01-15
description: "One-line description for meta/previews"
tags: ["tag1", "tag2"]
draft: false
---
```

## Deployment

- Push to main → Cloudflare Pages builds automatically
- Preview branches available at [branch].remoun-site.pages.dev
