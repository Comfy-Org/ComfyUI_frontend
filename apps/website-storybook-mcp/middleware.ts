import { timingSafeEqual } from 'node:crypto'

import { getToken } from '@auth/core/jwt'
import { next } from '@vercel/functions'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const mcpResource = 'https://comfy-website-storybook-mcp.vercel.app/mcp'
const descopeIssuer =
  'https://api.descope.com/v1/apps/agentic/P3INhU5D2mwSQ5EBnqS2YiYw80Vy/RS3INhm5qz6aYQOz5yR7uTrp7TQkD'
const descopeJwks = createRemoteJWKSet(
  new URL(
    'https://api.descope.com/P3INhU5D2mwSQ5EBnqS2YiYw80Vy/.well-known/jwks.json'
  )
)

export const config = {
  matcher: '/((?!api/auth|favicon|fonts|icons|login|[.]well-known).*)',
  runtime: 'nodejs'
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined
}

function matchesBearerToken(request: Request): boolean {
  const expected = process.env.STORYBOOK_MCP_TOKEN
  const supplied = getBearerToken(request)

  if (!expected || !supplied || expected.length !== supplied.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
}

async function hasDescopeSession(request: Request): Promise<boolean> {
  const supplied = getBearerToken(request)
  if (!supplied) return false

  try {
    const { payload } = await jwtVerify(supplied, descopeJwks, {
      audience: mcpResource,
      issuer: descopeIssuer
    })

    return (
      typeof payload.email === 'string' &&
      payload.email.toLowerCase().endsWith('@comfy.org')
    )
  } catch {
    return false
  }
}

async function hasGoogleSession(request: Request): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false

  const token = await getToken({
    req: request,
    secret,
    secureCookie: true
  })

  return token?.email?.endsWith('@comfy.org') === true
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname === '/mcp' || url.pathname === '/api/mcp') {
    if (
      matchesBearerToken(request) ||
      (await hasDescopeSession(request)) ||
      (await hasGoogleSession(request))
    ) {
      return next()
    }

    return new Response('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate':
          'Bearer resource_metadata="https://comfy-website-storybook-mcp.vercel.app/.well-known/oauth-protected-resource"'
      }
    })
  }

  if (await hasGoogleSession(request)) return next()

  const signInUrl = new URL('/api/auth/signin', request.url)
  signInUrl.searchParams.set('callbackUrl', request.url)
  return Response.redirect(signInUrl)
}
