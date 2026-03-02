export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const host = url.hostname;

  // 1. Handle remoun.blog
  if (host === 'remoun.blog') {
    // If requesting root, serve /blog index
    if (url.pathname === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/', url), request));
    }
    // If requesting /rss.xml, serve /blog/rss.xml
    if (url.pathname === '/rss.xml') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/rss.xml', url), request));
    }
    
    // REDIRECT FIX: Only redirect if the path starts with /blog/ AND it's not the root.
    // If someone visits remoun.blog/blog/foo, they should go to remoun.blog/foo.
    // If someone visits remoun.blog/blog/ (with trailing slash), they should go to remoun.blog/.
    if (url.pathname.startsWith('/blog/')) {
      const slug = url.pathname.slice(6); // remove "/blog/"
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    
    // Also handle /blog without trailing slash
    if (url.pathname === '/blog') {
      return Response.redirect(`https://remoun.blog/`, 301);
    }

    // If requesting a post without /blog/ prefix, rewrite to /blog/[slug]
    // We exclude paths with dots (assets) and the /blog prefix itself.
    if (!url.pathname.startsWith('/blog') && !url.pathname.includes('.')) {
      return context.env.ASSETS.fetch(new Request(new URL(`/blog${url.pathname}`, url), request));
    }
  }

  // 2. Handle remoun.love
  if (host === 'remoun.love') {
    if (url.pathname === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/love/', url), request));
    }
    // If someone goes to remoun.love/love/, redirect to root
    if (url.pathname.startsWith('/love/')) {
      const slug = url.pathname.slice(6); // remove "/love/"
      return Response.redirect(`https://remoun.love/${slug}`, 301);
    }
    if (url.pathname === '/love') {
      return Response.redirect(`https://remoun.love/`, 301);
    }
  }

  // 3. Handle canonical redirects for remoun.me
  if (host === 'remoun.me') {
    if (url.pathname === '/blog' || url.pathname === '/blog/') {
      return Response.redirect('https://remoun.blog/', 301);
    }
    if (url.pathname.startsWith('/blog/')) {
      const slug = url.pathname.slice(6);
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    if (url.pathname === '/love' || url.pathname === '/love/') {
      return Response.redirect('https://remoun.love/', 301);
    }
    if (url.pathname.startsWith('/love/')) {
      const slug = url.pathname.slice(6);
      return Response.redirect(`https://remoun.love/${slug}`, 301);
    }
  }

  return next();
}
