import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guards the follower boundary from
 * ADR CRDT-FOLLOWER-0031: the agent CRDT follower core and the semantic
 * graph-mutation layer must not import the renderer. Renderer access is
 * injected by the composition root (`AgentPanelRoot.vue`) through ports
 * such as `createAgentLayoutPort()`.
 */

const SRC_ROOT = join(__dirname, '..', '..', '..', '..')
const GUARDED_DIRS = [
  join(SRC_ROOT, 'workbench', 'extensions', 'agent', 'crdt')
]
const GUARDED_FILES = [join(SRC_ROOT, 'core', 'graph', 'graphMutations.ts')]
const RENDERER_IMPORT = /from\s+['"]@\/renderer\//

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__fixtures__' ? [] : listSourceFiles(full)
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return []
    return [full]
  })
}

describe('agent follower renderer boundary', () => {
  const files = [...GUARDED_DIRS.flatMap(listSourceFiles), ...GUARDED_FILES]

  it('scans the follower core', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('does not import @/renderer from follower core or graphMutations', () => {
    const offenders = files
      .filter((file) => RENDERER_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_ROOT, file))

    expect(offenders).toEqual([])
  })
})
