import { timingSafeEqual } from 'node:crypto'

import { getToken } from '@auth/core/jwt'
import { next } from '@vercel/functions'

export const config = {
  matcher: '/((?!api/auth).*)',
  runtime: 'nodejs'
}

function matchesBearerToken(request: Request): boolean {
  const expected = process.env.STORYBOOK_MCP_TOKEN
  const authorization = request.headers.get('authorization')
  const supplied = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined

  if (!expected || !supplied || expected.length !== supplied.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
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
    if (matchesBearerToken(request) || (await hasGoogleSession(request))) {
      return next()
    }

    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer realm="Comfy Storybook MCP"' }
    })
  }

  if (await hasGoogleSession(request)) return next()

  const signInUrl = new URL('/api/auth/signin', request.url)
  signInUrl.searchParams.set('callbackUrl', request.url)
  return Response.redirect(signInUrl)
}
