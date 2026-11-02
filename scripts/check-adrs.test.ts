import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import { findLegacyAdrReferences, validateAdrDirectory } from './check-adrs'

const temporaryDirectories: string[] = []

const adr = (id: string, date: string, status: string, body = ''): string =>
  `# ADR-${id}: Title\n\nDate: ${date}\n\n## Status\n\n${status}\n\n## Context\n\n${body}\n`

const createFixture = (files: Record<string, string> = {}): string => {
  const directory = join(
    tmpdir(),
    `comfyui-adr-check-${process.pid}-${temporaryDirectories.length}`
  )
  mkdirSync(directory)
  temporaryDirectories.push(directory)
  writeFileSync(
    join(directory, 'ECS-0008-entity-component-system.md'),
    adr('ECS-0008', '2026-03-23', 'Proposed')
  )
  for (const [filename, contents] of Object.entries(files)) {
    writeFileSync(join(directory, filename), contents)
  }
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true })
  }
})

describe('validateAdrDirectory', () => {
  test('accepts identifier-based ADRs', () => {
    expect(() => validateAdrDirectory(createFixture())).not.toThrow()
  })

  test('rejects numbered ADR filenames', () => {
    const directory = createFixture({
      '0024-new-decision.md': '# 24. New decision\n'
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      '0024-new-decision.md: invalid ADR filename'
    )
  })

  test.for([
    {
      name: 'a heading that is not the first line',
      contents: `Intro\n\n${adr('UI-0060', '2026-01-01', 'Accepted')}`,
      message: 'first line must be "# ADR-UI-0060: Title"'
    },
    {
      name: 'a heading naming another identifier',
      contents: adr('UI-0061', '2026-01-01', 'Accepted'),
      message: 'first line must be "# ADR-UI-0060: Title"'
    },
    {
      name: 'a Status with a second paragraph',
      contents: adr('UI-0060', '2026-01-01', 'Accepted\n\nApproved in review.'),
      message: 'Status must be one line'
    },
    {
      name: 'prose on the Status line',
      contents: adr(
        'UI-0060',
        '2026-01-01',
        'Accepted (2026-01-02). Approved.'
      ),
      message: 'Status must be one line'
    },
    {
      name: 'a leftover template comment',
      contents: adr(
        'UI-0060',
        '2026-01-01',
        'Accepted',
        '<!-- [Proposed | Accepted] -->'
      ),
      message: 'remove the leftover template comment'
    }
  ])('rejects $name', ({ contents, message }) => {
    const directory = createFixture({ 'UI-0060-decision.md': contents })

    expect(() => validateAdrDirectory(directory)).toThrow(
      `UI-0060-decision.md: ${message}`
    )
  })

  test('accepts a dated or linked one-line Status', () => {
    const directory = createFixture({
      'UI-0060-decision.md': adr(
        'UI-0060',
        '2026-01-01',
        'Accepted (2026-01-02)'
      ),
      'UI-0061-decision.md': adr(
        'UI-0061',
        '2026-01-01',
        'Superseded by [ADR-UI-0060](UI-0060-decision.md)'
      )
    })

    expect(() => validateAdrDirectory(directory)).not.toThrow()
  })

  test('rejects a new ADR that reuses a sequence number', () => {
    const directory = createFixture({
      'UI-0008-new-decision.md': adr('UI-0008', '2026-11-03', 'Accepted')
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      'UI-0008-new-decision.md: sequence number 0008 is already used'
    )
  })

  test('tolerates sequence numbers shared before the uniqueness rule', () => {
    const directory = createFixture({
      'UI-0008-old-decision.md': adr('UI-0008', '2026-11-02', 'Accepted')
    })

    expect(() => validateAdrDirectory(directory)).not.toThrow()
  })

  test('rejects an Accepted ADR that cites a Proposed one', () => {
    const directory = createFixture({
      'UI-0060-decision.md': adr(
        'UI-0060',
        '2026-01-01',
        'Accepted',
        'Builds on [ADR-ECS-0008](ECS-0008-entity-component-system.md).'
      )
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      'UI-0060-decision.md: cites ADR-ECS-0008, which is still Proposed'
    )
  })

  test('allows a Proposed ADR to cite another Proposed ADR', () => {
    const directory = createFixture({
      'UI-0060-decision.md': adr(
        'UI-0060',
        '2026-01-01',
        'Proposed',
        'Builds on ADR-ECS-0008.'
      )
    })

    expect(() => validateAdrDirectory(directory)).not.toThrow()
  })

  test('rejects a guidance file that cites a Proposed ADR', () => {
    expect(() =>
      validateAdrDirectory(createFixture(), [
        { filename: 'AGENTS.md', contents: 'Follow ADR-ECS-0008.' }
      ])
    ).toThrow('AGENTS.md: cites ADR-ECS-0008, which is still Proposed')
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
