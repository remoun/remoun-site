export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const host = url.hostname;

  // 1. Handle remoun.blog
  if (host === 'remoun.blog') {
    // If requesting root, serve /blog
    if (url.pathname === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog', url), request));
    }
    // If requesting /rss.xml, serve /blog/rss.xml
    if (url.pathname === '/rss.xml') {
      return context.env.ASSETS.fetch(new Request(new URL('/blog/rss.xml', url), request));
    }
    // If requesting /blog/*, redirect to the root version for canonicality
    if (url.pathname.startsWith('/blog/')) {
      const slug = url.pathname.replace('/blog/', '');
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    // If requesting a post without /blog/ prefix, rewrite to /blog/[slug]
    // But don't rewrite if it's already /blog/... or a static asset (has extension)
    if (!url.pathname.startsWith('/blog') && !url.pathname.includes('.')) {
      return context.env.ASSETS.fetch(new Request(new URL(`/blog${url.pathname}`, url), request));
    }
  }

  // 2. Handle remoun.love
  if (host === 'remoun.love') {
    // If requesting root, serve /love
    if (url.pathname === '/') {
      return context.env.ASSETS.fetch(new Request(new URL('/love', url), request));
    }
  }

  // 3. Handle canonical redirects for remoun.me
  // If someone visits remoun.me/blog, redirect to remoun.blog
  if (host === 'remoun.me') {
    if (url.pathname === '/blog' || url.pathname === '/blog/') {
      return Response.redirect('https://remoun.blog/', 301);
    }
    if (url.pathname.startsWith('/blog/')) {
      const slug = url.pathname.replace('/blog/', '');
      return Response.redirect(`https://remoun.blog/${slug}`, 301);
    }
    if (url.pathname === '/love' || url.pathname === '/love/') {
      return Response.redirect('https://remoun.love/', 301);
    }
    if (url.pathname.startsWith('/love/')) {
      const slug = url.pathname.replace('/love/', '');
      return Response.redirect(`https://remoun.love/${slug}`, 301);
    }
  }

  return next();
}
