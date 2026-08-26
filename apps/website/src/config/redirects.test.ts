import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

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
  const source = readFileSync(join(appDir, 'astro.config.ts'), 'utf-8')
  const block = /redirects:\s*\{([\s\S]*?)\n {2}\},/.exec(source)?.[1]

  const destinations = [
    // `'/from': { status: 307, destination: '/to/' }`
    ...[...(block ?? '').matchAll(/destination:\s*'([^']+)'/g)],
    // `'/from': '/to/'`, value sometimes wrapped onto the next line
    ...[...(block ?? '').matchAll(/^\s*'[^']+':\s*\n?\s*'([^']+)',?\s*$/gm)]
  ].map((match) => match[1])

  it('finds the redirect map', () => {
    // A regex that silently matches nothing would make every assertion vacuous.
    expect(block).toBeDefined()
    expect(destinations.length).toBeGreaterThanOrEqual(7)
  })

  it('every destination ends with a trailing slash', () => {
    const slashless = destinations.filter((d) => !d.endsWith('/'))
    expect(
      slashless,
      'these canonicalize one hop short of their target'
    ).toEqual([])
  })
})
