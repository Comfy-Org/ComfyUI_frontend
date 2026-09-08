import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { redirects as astroRedirects } from './redirects'
import { getRoutes } from './routes'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const VercelRedirectSchema = z.object({
  source: z.string(),
  destination: z.string(),
  permanent: z.boolean().optional(),
  statusCode: z.number().optional()
})

const VercelConfigSchema = z.object({
  redirects: z.array(VercelRedirectSchema)
})

type VercelRedirect = z.infer<typeof VercelRedirectSchema>

const { redirects } = VercelConfigSchema.parse(
  JSON.parse(readFileSync(join(appDir, 'vercel.json'), 'utf8'))
)

function findRedirect(source: string): VercelRedirect | undefined {
  return redirects.find((redirect) => redirect.source === source)
}

const minimaxCanonical = `${getRoutes('en').minimax}/`
const minimaxZhCanonical = `${getRoutes('zh-CN').minimax}/`

describe('legacy MiniMax H3 redirects', () => {
  it.for([
    { source: '/minimax', destination: minimaxCanonical },
    { source: '/minimax/', destination: minimaxCanonical },
    { source: '/zh-CN/minimax', destination: minimaxZhCanonical },
    { source: '/zh-CN/minimax/', destination: minimaxZhCanonical }
  ])(
    'sends $source to $destination with a temporary status',
    ({ source, destination }) => {
      const redirect = findRedirect(source)

      if (!redirect) {
        throw new Error(`${source} is missing from vercel.json`)
      }

      expect(redirect.destination).toBe(destination)
      expect(redirect.permanent, `${source} must be a temporary redirect`).toBe(
        false
      )
    }
  )

  it.for([
    getRoutes('en').minimax,
    minimaxCanonical,
    getRoutes('zh-CN').minimax,
    minimaxZhCanonical
  ])('leaves the new canonical path %s unredirected', (canonicalPath) => {
    expect(findRedirect(canonicalPath)).toBeUndefined()
  })
})

/**
 * Astro renders a stub page for each entry in its redirect map, and that stub's
 * canonical is the destination string verbatim. Every real page self-canonicalizes
 * with a trailing slash via `absoluteUrl()`, so a slash-less destination points
 * the stub's canonical one hop short of the page it redirects to.
 *
 * #14390 fixed exactly this once already and it regressed, which is why it is a
 * test now rather than a convention.
 */
describe('astro redirect destinations', () => {
  const destinations = Object.values(astroRedirects).map((entry) =>
    typeof entry === 'string' ? entry : entry.destination
  )

  it('every destination ends with a trailing slash', () => {
    const slashless = destinations.filter(
      (destination) => !destination.endsWith('/')
    )
    expect(
      slashless,
      'these canonicalize one hop short of their target'
    ).toEqual([])
  })
})

describe('legacy Enterprise redirects', () => {
  it.for([
    '/cloud/enterprise',
    '/cloud/enterprise/',
    '/zh-CN/cloud/enterprise',
    '/zh-CN/cloud/enterprise/'
  ])('sends %s to the canonical Enterprise route permanently', (source) => {
    const redirect = findRedirect(source)

    if (!redirect) {
      throw new Error(`${source} is missing from vercel.json`)
    }

    expect(redirect.destination).toBe('/enterprise/')
    expect(redirect.permanent).toBe(true)
  })

  it('leaves the canonical Enterprise routes unredirected', () => {
    expect(findRedirect('/enterprise')).toBeUndefined()
    expect(findRedirect('/enterprise/')).toBeUndefined()
    expect(findRedirect('/enterprise/managed-builds')).toBeUndefined()
    expect(findRedirect('/enterprise/managed-builds/')).toBeUndefined()
  })
})
