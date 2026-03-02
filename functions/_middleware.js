async function getBlogSlugs(context, url) {
  try {
    const response = await context.env.ASSETS.fetch(
      new Request(new URL('/blog-slugs.json', url))
    );
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) return new Set();
    return new Set(await response.json());
  } catch {
    return new Set();
  }
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const host = url.hostname;
  const path = url.pathname;

  // Universal: /love → remoun.love (from any other domain)
  if (host !== 'remoun.love') {
    if (path === '/love' || path === '/love/') {
      return Response.redirect('https://remoun.love/', 301);
    }
    if (path.startsWith('/love/')) {
      return Response.redirect(`https://remoun.love/${path.slice(6)}`, 301);
    }
  }

  // Load the build-time list of blog post slugs for routing decisions.
  // Loaded lazily: only when the request is for a domain/path that needs it.
  // ASSETS.fetch() always returns 200 (falls back to nearest index.html),
  // so we can't use status codes to detect whether a page exists.
  let _blogSlugs;
  async function isBlogSlug(s) {
    if (!_blogSlugs) _blogSlugs = await getBlogSlugs(context, url);
    return _blogSlugs.has(s);
  }
  const slug = path.slice(1).replace(/\/$/, ''); // "/foo/" → "foo"

  // 1. Handle remoun.blog
  if (host === 'remoun.blog') {
    // Canonicalize /blog/* to the root version
    // e.g. remoun.blog/blog/my-post → remoun.blog/my-post
    if (path.startsWith('/blog/')) {
      return Response.redirect(`https://remoun.blog/${path.slice(6)}`, 301);
    }
    if (path === '/blog') {
      return Response.redirect('https://remoun.blog/', 301);
    }

    // Serve root as /blog/ index
    if (path === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/', url), request));
    }

    // Serve RSS feed
    if (path === '/rss.xml') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/rss.xml', url), request));
    }

    // Known blog post → serve from /blog/ via internal rewrite
    if (await isBlogSlug(slug)) {
      return context.env.ASSETS.fetch(new Request(new URL(`/blog/${slug}`, url), request));
    }

    // Everything else on remoun.blog → redirect to remoun.me
    // e.g. remoun.blog/admin → remoun.me/admin
    if (!path.includes('.')) {
      return Response.redirect(`https://remoun.me${path}`, 301);
    }
  }

  // 2. Handle remoun.love
  if (host === 'remoun.love') {
    // Canonicalize /love/* to the root version
    if (path.startsWith('/love/')) {
      return Response.redirect(`https://remoun.love/${path.slice(6)}`, 301);
    }
    if (path === '/love') {
      return Response.redirect('https://remoun.love/', 301);
    }

    // Serve root as /love/ page
    if (path === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/love/', url), request));
    }

    // Everything else on remoun.love → redirect to remoun.me
    if (!path.includes('.')) {
      return Response.redirect(`https://remoun.me${path}`, 301);
    }
  }

  // 3. Handle canonical redirects for remoun.me
  if (host === 'remoun.me') {
    // /blog/* → remoun.blog
    if (path.startsWith('/blog')) {
      const slug = path.startsWith('/blog/') ? path.slice(6) : '';
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }

    // Blog slug at the root → redirect to remoun.blog
    // e.g. remoun.me/face-blur-tool → remoun.blog/face-blur-tool
    if (!path.includes('.') && path !== '/' && await isBlogSlug(slug)) {
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }

    // Everything else (portfolio, resume, tools, etc.) served normally by next()
  }

  return next();
}
