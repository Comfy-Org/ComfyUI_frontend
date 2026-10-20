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

export const catalogStoryPatterns = config.include.filter((pattern) =>
  pattern.endsWith('.stories.ts')
)

export async function discoverCatalogStories(root: string): Promise<string[]> {
  const files: string[] = []
  for await (const path of glob(catalogStoryPatterns, { cwd: root })) {
    files.push(resolve(root, path))
  }
  return files.sort()
}
