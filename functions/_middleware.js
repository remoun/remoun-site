// Cloudflare Pages middleware for host-based routing
// Requests to remoun.love serve the /love page

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // If this is remoun.love and requesting root, rewrite to /love
  if (url.hostname === 'remoun.love' && url.pathname === '/') {
    const newUrl = new URL('/love', url);
    return context.env.ASSETS.fetch(new Request(newUrl, request));
  }
  
  // For all other requests, continue normally
  return next();
}
