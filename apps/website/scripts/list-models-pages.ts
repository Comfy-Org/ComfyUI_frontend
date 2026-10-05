/** Prints every built page under the Models URL registry's roots, sorted. */
import { existsSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { websiteRoot } from '@website/paths'
import { modelsUrlRoots } from '@/config/models-url-registry'

const DIST = join(websiteRoot, 'dist')

function indexPages(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return indexPages(full)
    return entry.name === 'index.html' ? [full] : []
  })
}

const pages = new Set(
  modelsUrlRoots.flatMap((root) =>
    indexPages(join(DIST, root)).map((file) =>
      relative(DIST, file).split(sep).join('/')
    )
  )
)

process.stdout.write(
  [...pages]
    .sort()
    .map((page) => `${page}\n`)
    .join('')
)
