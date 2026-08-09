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
      // Temporary on purpose: /minimax will be reclaimed as an all-models hub,
      // so the legacy redirect must not permanently consolidate onto /minimax-h3.
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
