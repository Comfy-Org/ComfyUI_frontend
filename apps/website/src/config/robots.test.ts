import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { BUILD_ASSETS_DIR } from './build'

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const robotsTxt = readFileSync(
  join(websiteRoot, 'public', 'robots.txt'),
  'utf8'
)

const disallowedPaths = robotsTxt
  .split('\n')
  .map((line) => /^disallow:\s*(\S+)/i.exec(line.trim())?.[1])
  .filter((path): path is string => path !== undefined)

describe('robots.txt', () => {
  it.for([`/${BUILD_ASSETS_DIR}/`, '/_astro/'])(
    'lets crawlers fetch the scripts and styles under %s',
    (assetDir) => {
      const blocking = disallowedPaths.filter((path) =>
        assetDir.startsWith(path)
      )
      expect(blocking).toEqual([])
    }
  )
})
