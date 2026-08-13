/**
 * Regenerates `src/platform/nodeApi/apiSurface.ts` from the published
 * interfaces.
 *
 *   node scripts/magic-patch/gen_api_surface.mjs
 *
 * The generated set is what the conformance harness checks converted code
 * against, so it has to track the API exactly; `apiSurface.test.ts` re-derives
 * it and fails if this was not re-run.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = new URL('../../src/platform/nodeApi/', import.meta.url).pathname

export function deriveApiMembers(dir = DIR) {
  const members = new Set()
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
    const source = readFileSync(join(dir, file), 'utf8')
    for (const [, body] of source.matchAll(
      // Not just `export interface`: a type reachable through a published
      // method's return value is part of the surface whether or not its NAME
      // is exported. Several were un-exported to satisfy knip, which silently
      // dropped their members and made the conformance check reject correct
      // conversions using them.
      /(?:export )?interface \w+[^{]*\{([\s\S]*?)\n\}/g
    )) {
      for (const line of body.split('\n')) {
        // `<` matters: a generic signature like `getProperty<T>(key)` was
        // silently skipped, so shipped members were missing from the surface
        // and the conformance check rejected conversions that used them.
        const match = /^\s*(?:readonly\s+)?([A-Za-z_]\w*)\s*[(?:<]/.exec(line)
        if (match) members.add(match[1])
      }
    }
  }
  return members
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const names = [...deriveApiMembers()].sort()
  const header = readFileSync(join(DIR, 'apiSurface.ts'), 'utf8').split(
    'export const API_MEMBERS'
  )[0]
  writeFileSync(
    join(DIR, 'apiSurface.ts'),
    `${header}export const API_MEMBERS: ReadonlySet<string> = new Set([\n${names
      .map((n) => `  '${n}',`)
      .join('\n')}\n])\n`
  )
  console.error(`${names.length} members`)
}
