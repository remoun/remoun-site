# remoun-site

Unified personal infrastructure for `remoun.*` domains.

## Structure

```
remoun-site/
├── src/
│   ├── content/
│   │   ├── posts/        # Blog posts (Markdown)
│   │   └── projects/     # Portfolio items (Markdown)
│   ├── layouts/
│   ├── pages/
│   │   ├── blog/         # Blog routes
│   │   ├── portfolio/    # Portfolio routes
│   │   ├── index.astro   # Landing page
│   │   └── resume.astro  # Resume page
│   └── styles/
├── workers/
│   └── shortener/        # remoun.to URL shortener
└── public/               # Static assets
```

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Deployment

### Main Site (Cloudflare Pages)

1. Push to GitHub
2. Connect repo to Cloudflare Pages
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add custom domains in Cloudflare Pages settings:
   - `remoun.dev` (primary)
   - `remoun.blog`

### URL Shortener (Cloudflare Worker)

```bash
cd workers/shortener

# Install wrangler if needed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy

# After deploy, configure custom domain in Cloudflare dashboard:
# Workers & Pages → remoun-shortener → Settings → Triggers → Custom Domains
# Add: remoun.to
```

### Domain Aliases

For `remoun.tech` → `remoun.dev`, add a redirect rule in Cloudflare:

1. Go to `remoun.tech` domain in Cloudflare
2. Rules → Redirect Rules → Create Rule
3. When: Hostname equals `remoun.tech`
4. Then: Dynamic redirect to `https://remoun.dev${http.request.uri.path}`
5. Status code: 301

### remoun.love (Date Me Page)

The `/love` page has its own layout and styling. To serve it at `remoun.love`:

1. Add `remoun.love` as a custom domain in Cloudflare Pages (same as other domains)
2. The `functions/_middleware.js` handles the routing:
   - Requests to `remoun.love/` serve the `/love` page
   - Other domains serve content normally

The middleware runs at the edge, so there's no redirect — visitors see `remoun.love` in their browser.

## Adding Content

### Blog Posts

Create `src/content/posts/your-slug.md`:

```markdown
---
title: "Post Title"
description: "Brief description for previews and SEO."
date: 2024-12-25
tags: [tag1, tag2]
draft: false # Set true to hide from listings
---

Your content here...
```

### Portfolio Projects

Create `src/content/projects/project-slug.md`:

```markdown
---
title: "Project Name"
description: "What it does."
date: 2024-12-25
image: "/images/project-screenshot.png" # optional
link: "https://github.com/..." # optional external link
tags: [tech, stack]
featured: true # Shows on homepage
---

Longer description...
```

### Short URLs

Edit `workers/shortener/redirects.json`:

```json
{
  "gh": "https://github.com/remoun",
  "newlink": "https://example.com/whatever"
}
```

Then redeploy: `cd workers/shortener && wrangler deploy`

## Future Enhancements

- [ ] Newsletter signup (Buttondown/ConvertKit)
- [ ] KV-backed shortener with web UI
- [ ] PDF resume generation from Astro page

## Web Editing with Decap CMS

The site includes Decap CMS at `/admin` for editing posts and projects from your phone or any browser.

### Setup

1. **Register your OAuth app with GitHub:**

   - Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
   - Application name: `remoun-site` (or whatever)
   - Homepage URL: `https://remoun.dev`
   - Authorization callback URL: `https://oauth.decapcms.org/callback`
   - Save your Client ID and Client Secret

2. **Register with Decap's OAuth service:**

   - Go to https://oauth.decapcms.org/
   - Add your GitHub OAuth app credentials
   - This proxies the OAuth flow so you don't need to run your own server

3. **Update the config** (if needed):

   - Edit `public/admin/config.yml`
   - Change `repo: remoun/remoun-site` to match your GitHub username/repo

4. **Access the CMS:**
   - Go to `https://remoun.dev/admin`
   - Log in with GitHub
   - Create and edit posts/projects

### Local Development

For local testing without auth, uncomment `local_backend: true` in `config.yml` and run:

```bash
npx decap-server
```

Then the CMS at `localhost:4321/admin` will work without GitHub auth.

### Self-hosted OAuth (optional)

If you prefer not to use Decap's hosted OAuth, you can deploy your own proxy as a Cloudflare Worker. See `workers/oauth/` for a ready-to-deploy implementation. Update `base_url` in `config.yml` to point to your worker.
