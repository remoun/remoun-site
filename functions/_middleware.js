export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const host = url.hostname;
  const path = url.pathname;

  // Universal redirects: /love → remoun.love, /blog → remoun.blog (from any domain)
  if (path === '/love' || path === '/love/') {
    if (host !== 'remoun.love') {
      return Response.redirect('https://remoun.love/', 301);
    }
  }
  if (path.startsWith('/love/') && host !== 'remoun.love') {
    const slug = path.slice(6);
    return Response.redirect(`https://remoun.love/${slug}`, 301);
  }

  // 1. Handle remoun.blog
  if (host === 'remoun.blog') {
    // Canonicalize /blog/* to the root version
    if (path.startsWith('/blog/')) {
      const slug = path.slice(6);
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    if (path === '/blog') {
      return Response.redirect('https://remoun.blog/', 301);
    }

    // Serve root as /blog/ index
    if (path === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/', url), request));
    }

    // Rewrite clean paths to /blog/ prefix (posts and rss.xml)
    if (!path.includes('.') || path === '/rss.xml') {
      const blogPath = path === '/rss.xml' ? '/blog/rss.xml' : `/blog${path}`;
      return context.env.ASSETS.fetch(new Request(new URL(blogPath, url), request));
    }
  }

  // 2. Handle remoun.love
  if (host === 'remoun.love') {
    // Canonicalize /love/* to the root version
    if (path.startsWith('/love/')) {
      const slug = path.slice(6);
      return Response.redirect(`https://remoun.love/${slug}`, 301);
    }
    if (path === '/love') {
      return Response.redirect('https://remoun.love/', 301);
    }

    // Serve root as /love/ page
    if (path === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/love/', url), request));
    }

    // Everything else on remoun.love redirects to remoun.me
    if (!path.includes('.')) {
      return Response.redirect(`https://remoun.me${path}`, 301);
    }
  }

  // 3. Handle canonical redirects for remoun.me
  if (host === 'remoun.me') {
    if (path.startsWith('/blog')) {
      const slug = path.startsWith('/blog/') ? path.slice(6) : '';
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    if (path.startsWith('/love')) {
      const slug = path.startsWith('/love/') ? path.slice(6) : '';
      return Response.redirect(`https://remoun.love/${slug}`, 301);
    }

    // For unknown extensionless paths, check if they're blog posts
    // and redirect to remoun.blog if so (e.g. remoun.me/face-blur-tool → remoun.blog/face-blur-tool)
    if (!path.includes('.') && path !== '/') {
      const blogResponse = await context.env.ASSETS.fetch(
        new Request(new URL(`/blog${path}`, url), request)
      );
      if (blogResponse.ok) {
        return Response.redirect(`https://remoun.blog${path}`, 301);
      }
    }
  }

  return next();
}
