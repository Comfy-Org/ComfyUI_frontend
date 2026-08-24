const metadata = {
  authorization_servers: [
    'https://api.descope.com/v1/apps/agentic/P3INhU5D2mwSQ5EBnqS2YiYw80Vy/RS3INhm5qz6aYQOz5yR7uTrp7TQkD'
  ],
  bearer_methods_supported: ['header'],
  resource: 'https://comfy-website-storybook-mcp.vercel.app/mcp',
  scopes_supported: ['openid', 'profile', 'email', 'phone', 'storybook:read']
}

export function GET(): Response {
  return Response.json(metadata, {
    headers: { 'Cache-Control': 'public, max-age=300' }
  })
}
