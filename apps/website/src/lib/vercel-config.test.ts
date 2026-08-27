import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface VercelRoute {
  source: string
  destination?: string
  permanent?: boolean
  headers?: { key: string; value: string }[]
  has?: unknown[]
}

interface VercelConfig {
  rewrites?: VercelRoute[]
  redirects?: VercelRoute[]
  headers?: VercelRoute[]
}

const config = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')
) as VercelConfig

describe('vercel.json agent-readiness surface', () => {
  it('publishes the live OpenAPI spec at /openapi.json and /api/openapi.json', () => {
    const sources = (config.rewrites ?? []).filter(
      (rule) => rule.destination === 'https://api.comfy.org/openapi'
    )
    expect(sources.map((rule) => rule.source).sort()).toEqual([
      '/api/openapi.json',
      '/openapi.json'
    ])
  })

  it('sets Vary: Accept on extension-less page paths', () => {
    const rule = (config.headers ?? []).find((entry) =>
      entry.headers?.some(
        (header) => header.key === 'Vary' && header.value === 'Accept'
      )
    )
    expect(rule).toBeDefined()
    // Must exclude asset extensions (including .md twins and llms.txt) while
    // keeping dotted page routes like /seedance-2.5 covered, must match the
    // middleware.ts matcher, and must not be host-scoped.
    expect(rule?.source).toBe(
      '/((?!.*\\.(?:md|txt|xml|json|ico|png|jpg|jpeg|webp|avif|gif|svg|css|js|mjs|map|woff|woff2|ttf|otf|eot|mp4|webm|vtt|pdf|zip|webmanifest)$).*)'
    )
    expect(rule?.has).toBeUndefined()
  })

  it('canonicalizes the markdown twins to their HTML pages', () => {
    const linkFor = (source: string) =>
      (config.headers ?? [])
        .find((entry) => entry.source === source)
        ?.headers?.find((header) => header.key === 'Link')?.value
    expect(linkFor('/index.md')).toBe('<https://comfy.org/>; rel="canonical"')
    expect(linkFor('/api.md')).toBe('<https://comfy.org/api>; rel="canonical"')
  })

  it('keeps predictable developer entry points', () => {
    const redirects = config.redirects ?? []
    expect(
      redirects.find((rule) => rule.source === '/developers')?.destination
    ).toBe('/api')
    expect(redirects.find((rule) => rule.source === '/docs')?.destination).toBe(
      'https://docs.comfy.org/'
    )
  })

  it('preserves the pre-existing redirects', () => {
    const redirects = config.redirects ?? []
    expect(
      redirects.find((rule) => rule.source === '/pricing')?.destination
    ).toBe('/cloud/pricing')
    expect(
      redirects.find((rule) => rule.source === '/login')?.destination
    ).toBe('https://cloud.comfy.org/cloud/login')
  })

  it('preserves the anti-noindex header for the production origin host', () => {
    const rule = (config.headers ?? []).find(
      (entry) =>
        entry.source === '/(.*)' &&
        entry.headers?.some((header) => header.key === 'X-Robots-Tag')
    )
    expect(rule?.has).toEqual([
      { type: 'host', value: 'website-frontend-comfyui.vercel.app' }
    ])
    expect(
      rule?.headers?.find((header) => header.key === 'X-Robots-Tag')?.value
    ).toBe('index, follow')
  })
})
