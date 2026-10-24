import { readFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { z } from 'zod'

const websiteRoot = dirname(import.meta.dirname)
const config = z
  .object({ include: z.array(z.string()) })
  .parse(
    JSON.parse(readFileSync(join(websiteRoot, 'tsconfig.stories.json'), 'utf8'))
  )

export function storyPatterns(include: string[]): string[] {
  const unsupported = include.filter(
    (pattern) =>
      /stories|\.mdx/.test(pattern) && !pattern.endsWith('.stories.ts')
  )
  if (unsupported.length)
    throw new Error(
      `Unsupported catalog story patterns: ${unsupported.join(', ')}`
    )
  const patterns = include.filter((pattern) => pattern.endsWith('.stories.ts'))
  if (!patterns.length) throw new Error('Missing catalog story patterns')
  return patterns
}

export const catalogStoryPatterns = storyPatterns(config.include)

export async function discoverCatalogStories(root: string): Promise<string[]> {
  const files: string[] = []
  for await (const path of glob(catalogStoryPatterns, { cwd: root })) {
    files.push(resolve(root, path))
  }
  return files.sort()
}
