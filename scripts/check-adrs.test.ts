import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import {
  findLegacyAdrReferences,
  isScannedForLegacyReferences,
  validateAdrDirectory
} from './check-adrs'

const temporaryDirectories: string[] = []

const createFixture = (): string => {
  const directory = join(
    tmpdir(),
    `comfyui-adr-check-${process.pid}-${temporaryDirectories.length}`
  )
  mkdirSync(directory)
  temporaryDirectories.push(directory)
  writeFileSync(
    join(directory, 'ECS-0008-entity-component-system.md'),
    '# ADR-ECS-0008: Entity Component System\n\nDate: 2026-03-23\n\n## Status\n\nProposed\n'
  )
  writeFileSync(
    join(directory, 'README.md'),
    '| [ECS-0008](ECS-0008-entity-component-system.md) | Entity Component System | Proposed | 2026-03-23 |\n'
  )
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true })
  }
})

describe('validateAdrDirectory', () => {
  test('accepts identifier-based ADRs with a matching index', () => {
    expect(() => validateAdrDirectory(createFixture())).not.toThrow()
  })

  test('rejects numbered ADR filenames', () => {
    const directory = createFixture()
    writeFileSync(
      join(directory, '0024-new-decision.md'),
      '# 24. New decision\n'
    )

    expect(() => validateAdrDirectory(directory)).toThrow(
      'Invalid ADR filenames'
    )
  })

  test('rejects index metadata that differs from the ADR', () => {
    const directory = createFixture()
    writeFileSync(
      join(directory, 'README.md'),
      '| [ECS-0008](ECS-0008-entity-component-system.md) | Wrong title | Proposed | 2026-03-23 |\n'
    )

    expect(() => validateAdrDirectory(directory)).toThrow(
      'ADR index must contain every ADR exactly once'
    )
  })

  test('rejects an additional legacy index row', () => {
    const directory = createFixture()
    writeFileSync(
      join(directory, 'README.md'),
      [
        '| [ECS-0008](ECS-0008-entity-component-system.md) | Entity Component System | Proposed | 2026-03-23 |',
        '| [0008](0008-entity) | Legacy duplicate | Proposed | 2026-03-23 |'
      ].join('\n')
    )

    expect(() => validateAdrDirectory(directory)).toThrow(
      'Invalid ADR index rows'
    )
  })
})

describe('findLegacyAdrReferences', () => {
  test.for(
    [
      ['ecosystem (ADR-LAYOUT / ', '0008)'],
      ['current in ADR-LAYOUT/', '0008 and inventory'],
      ['This ADR (', '0008) defines the entity data model'],
      ['See ADR-', '0008 for details'],
      ['See docs/adr/', '0008-entity-component-system.md']
    ].map((parts) => parts.join(''))
  )('detects legacy reference form: %s', (reference) => {
    expect(findLegacyAdrReferences(reference)).toEqual([
      { line: reference, lineNumber: 1 }
    ])
  })

  test('does not confuse an amendment date with an ADR number', () => {
    expect(
      findLegacyAdrReferences('ADR-CRDT-LAYOUT-0003 amendment (2026-08-23)')
    ).toEqual([])
  })
})

describe('isScannedForLegacyReferences', () => {
  // Paths are joined from parts so this file does not itself contain a literal
  // legacy reference, which the repository-wide scan would flag.
  test.for(
    [
      ['packages/comfy-multi-player/docs/adr/', '0001-op-based-crdt-v1.md'],
      ['packages/comfy-multi-player/docs/', 'INVARIANTS.md'],
      ['packages/comfy-multi-player/src/', 'types.ts']
    ].map((parts) => parts.join(''))
  )('skips the self-governed ADR corpus in %s', (filename) => {
    expect(isScannedForLegacyReferences(filename)).toBe(false)
  })

  test.for([
    'docs/adr/README.md',
    'docs/adr/ECS-0008-entity-component-system.md',
    'src/workbench/extensions/agent/crdt/ecsFollowerAdapter.ts',
    'packages/design-system/docs/notes.md'
  ])('still scans this repository own file %s', (filename) => {
    expect(isScannedForLegacyReferences(filename)).toBe(true)
  })
})
