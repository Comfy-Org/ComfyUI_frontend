import { Auth } from '@auth/core'
import Google from '@auth/core/providers/google'

const authRedirectProxyUrl =
  'https://comfy-website-storybook-mcp.vercel.app/api/auth'

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function createAuthConfig() {
  return {
    providers: [
      Google({
        clientId: requiredEnvironmentVariable('AUTH_GOOGLE_ID'),
        clientSecret: requiredEnvironmentVariable('AUTH_GOOGLE_SECRET')
      })
    ],
    basePath: '/api/auth',
    pages: { signIn: '/login' },
    redirectProxyUrl: authRedirectProxyUrl,
    secret: requiredEnvironmentVariable('AUTH_SECRET'),
    trustHost: true,
    session: { strategy: 'jwt' as const },
    callbacks: {
      signIn({ profile }: { profile?: Record<string, unknown> }) {
        return (
          profile?.email_verified === true &&
          typeof profile.email === 'string' &&
          profile.email.endsWith('@comfy.org')
        )
      }
    }
  }
}

function handleAuthRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.searchParams.get('path')

  if (path) {
    url.pathname = `/api/auth/${path}`
    url.searchParams.delete('path')
  }

  return Auth(new Request(url, request), createAuthConfig())
}

export const GET = handleAuthRequest
export const POST = handleAuthRequest
