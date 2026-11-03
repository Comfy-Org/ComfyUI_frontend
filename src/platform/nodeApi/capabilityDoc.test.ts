import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { reachableDeclarationNames } from '../../../scripts/node-api/gen_api_surface.mjs'

describe('the documented capability list', () => {
  it('matches CAPABILITIES', () => {
    // A stale list is not a documentation nit. When the doc said eleven
    // capabilities and the code had eighteen, agents read widgets.mount,
    // widgets.canvas, setSizeConstraints and defs.define as unimplemented and
    // punted twelve files against API that already existed.
    expect(() =>
      execFileSync('node', [
        'scripts/node-api/gen_capability_list.mjs',
        '--check'
      ])
    ).not.toThrow()
  })

  it('routes every reviewed service and extension hook', () => {
    const reference = readFileSync('docs/node-api/reference.md', 'utf8')

    for (const entry of [
      '`system`',
      '`SystemHandle`',
      '`monitor(): Promise<SystemMonitorSnapshot>`',
      '`playSound(def: PlaySoundDef): Promise<void>`',
      '`documentId(): string | undefined`',
      '`onPromptSerialize`',
      '`PromptInputProjection`',
      '`PromptInputProjector`'
    ]) {
      expect(reference).toContain(entry)
    }

    for (const privateEntry of [
      '`cacheSize`',
      '## Host-plumbing declarations'
    ]) {
      expect(reference).not.toContain(privateEntry)
    }
  })

  it('names every public type reachable from Comfy', () => {
    const reference = readFileSync('docs/node-api/reference.md', 'utf8')
    const missing = [
      ...reachableDeclarationNames('src/platform/nodeApi')
    ].filter((name) => !reference.includes(`\`${name}\``))

    expect(missing).toEqual([])
  })

  it('documents async resolver behavior consistently', () => {
    const guides = ['execution.md', 'how-to.md', 'demo-nodes.md'].map((name) =>
      readFileSync(`docs/node-api/${name}`, 'utf8')
    )

    for (const guide of guides) {
      expect(guide).toMatch(/resolver[\s\S]{0,500}(promise|async)/i)
      expect(guide).not.toMatch(/resolvers? (?:are|is) pure and synchronous/i)
    }
  })
})
