import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { getRoutes } from './routes'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

interface VercelRedirect {
  source: string
  destination: string
  permanent?: boolean
  statusCode?: number
}

const redirects: VercelRedirect[] = JSON.parse(
  readFileSync(join(appDir, 'vercel.json'), 'utf8')
).redirects

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
    'sends $source to $destination with a permanent status',
    ({ source, destination }) => {
      const redirect = findRedirect(source)

      expect(redirect, `${source} is missing from vercel.json`).toBeDefined()
      expect(redirect!.destination).toBe(destination)
      expect(
        redirect!.permanent,
        `${source} must be a permanent redirect`
      ).toBe(true)
    }
  )

  it('leaves the new canonical paths unredirected', () => {
    expect(findRedirect(minimaxCanonical)).toBeUndefined()
    expect(findRedirect(getRoutes('en').minimax)).toBeUndefined()
  })
})
