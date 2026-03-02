export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const host = url.hostname;
  const path = url.pathname;

  // 1. Handle remoun.blog
  if (host === 'remoun.blog') {
    // Canonicalize /blog/* to root
    if (path.startsWith('/blog/')) {
      const slug = path.slice(6);
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    if (path === '/blog') {
      return Response.redirect('https://remoun.blog/', 301);
    }

    // Special case for root: serve /blog/ index
    if (path === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/', url), request));
    }

    // Dynamic Rewrite: Try to serve from /blog/ first (covers posts and rss.xml)
    if (!path.includes('.') || path === '/rss.xml') {
      const blogPath = path === '/rss.xml' ? '/blog/rss.xml' : `/blog${path}`;
      const blogResponse = await context.env.ASSETS.fetch(new Request(new URL(blogPath, url), request));
      if (blogResponse.status === 200) {
        return blogResponse;
      }

      // Fallback: If not in /blog/, check if it exists at the root level
      if (!path.includes('.')) {
        const rootResponse = await context.env.ASSETS.fetch(new Request(new URL(path, url), request));
        if (rootResponse.status === 200) {
          return Response.redirect(`https://remoun.me${path}`, 301);
        }
      }
    }
  }

  // 2. Handle remoun.love
  if (host === 'remoun.love') {
    // Canonicalize /love/* to root
    if (path.startsWith('/love/')) {
      const slug = path.slice(6);
      return Response.redirect(`https://remoun.love/${slug}`, 301);
    }
    if (path === '/love') {
      return Response.redirect('https://remoun.love/', 301);
    }

    // Special case for root: serve /love/ index
    if (path === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/love/', url), request));
    }
    
    // Redirect everything else on remoun.love to remoun.me
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
  }

  return next();
}
