// Cloudflare Pages middleware for host-based routing
// Requests to remoun.love serve the /love page
// Requests to remoun.blog serve the /blog page

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // If this is remoun.love and requesting root, rewrite to /love
  if (url.hostname === 'remoun.love' && url.pathname === '/') {
    const newUrl = new URL('/love', url);
    return context.env.ASSETS.fetch(new Request(newUrl, request));
  }

  // If this is remoun.blog and requesting root, rewrite to /blog
  if (url.hostname === 'remoun.blog' && url.pathname === '/') {
    const newUrl = new URL('/blog', url);
    return context.env.ASSETS.fetch(new Request(newUrl, request));
  }

  // For all other requests, continue normally
  return next();
}
