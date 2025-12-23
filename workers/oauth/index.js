/**
 * Decap CMS OAuth Proxy for GitHub
 * 
 * Deploy this worker and set these secrets:
 *   wrangler secret put GITHUB_CLIENT_ID
 *   wrangler secret put GITHUB_CLIENT_SECRET
 * 
 * Then update public/admin/config.yml:
 *   base_url: https://your-oauth-worker.your-subdomain.workers.dev
 */

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers for the token endpoint
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // /auth - Start OAuth flow
    if (url.pathname === '/auth') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/callback`,
        scope: 'repo user',
        state: crypto.randomUUID(),
      });
      return Response.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`, 302);
    }

    // /callback - Exchange code for token
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      
      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(`OAuth error: ${tokenData.error_description}`, { status: 400 });
      }

      // Return HTML that posts the token back to the opener window
      const html = `<!DOCTYPE html>
<html>
<head><title>OAuth Complete</title></head>
<body>
<script>
  (function() {
    const token = ${JSON.stringify(tokenData.access_token)};
    const provider = 'github';
    
    if (window.opener) {
      window.opener.postMessage(
        'authorization:' + provider + ':success:' + JSON.stringify({ token, provider }),
        '*'
      );
      window.close();
    }
  })();
</script>
<p>Authentication successful. This window should close automatically.</p>
</body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Default: show usage
    return new Response(
      'Decap CMS OAuth Proxy\n\nEndpoints:\n  /auth - Start OAuth flow\n  /callback - OAuth callback',
      { status: 200 }
    );
  },
};
