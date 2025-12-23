import redirects from './redirects.json';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1).toLowerCase(); // remove leading slash, normalize case

    // Root path → show a simple landing or redirect to main site
    if (!path) {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>remoun.to</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 4rem auto; padding: 1rem; }
    h1 { font-size: 1.5rem; }
    ul { list-style: none; padding: 0; }
    li { margin: 0.5rem 0; }
    a { color: #c45a3b; }
  </style>
</head>
<body>
  <h1>remoun.to</h1>
  <p>Quick links:</p>
  <ul>
    ${Object.entries(redirects).map(([key, dest]) => 
      `<li><a href="/${key}">/${key}</a> → ${new URL(dest).hostname}</li>`
    ).join('\n    ')}
  </ul>
  <p><a href="https://remoun.dev">← remoun.dev</a></p>
</body>
</html>`,
        {
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Look up the redirect
    const destination = redirects[path];
    
    if (destination) {
      return Response.redirect(destination, 301);
    }

    // 404 for unknown paths
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Not Found | remoun.to</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 4rem auto; padding: 1rem; }
    a { color: #c45a3b; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>No redirect found for <code>/${path}</code></p>
  <p><a href="/">See all links</a> · <a href="https://remoun.dev">remoun.dev</a></p>
</body>
</html>`,
      {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  },
};
