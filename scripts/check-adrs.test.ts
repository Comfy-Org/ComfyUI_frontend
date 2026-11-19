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
    join(directory, 'ECS-entity-component-system.md'),
    adr('ECS-entity-component-system', '2026-03-23', 'Proposed')
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
      contents: `Intro\n\n${adr('UI-decision', '2026-01-01', 'Accepted')}`,
      message: 'first line must be "# ADR-UI-decision: Title"'
    },
    {
      name: 'a heading naming another identifier',
      contents: adr('UI-other', '2026-01-01', 'Accepted'),
      message: 'first line must be "# ADR-UI-decision: Title"'
    },
    {
      name: 'a Status with a second paragraph',
      contents: adr(
        'UI-decision',
        '2026-01-01',
        'Accepted\n\nApproved in review.'
      ),
      message: 'Status must be one line'
    },
    {
      name: 'prose on the Status line',
      contents: adr(
        'UI-decision',
        '2026-01-01',
        'Accepted (2026-01-02). Approved.'
      ),
      message: 'Status must be one line'
    },
    {
      name: 'a leftover template comment',
      contents: adr(
        'UI-decision',
        '2026-01-01',
        'Accepted',
        '<!-- [Proposed | Accepted] -->'
      ),
      message: 'remove the leftover template comment'
    }
  ])('rejects $name', ({ contents, message }) => {
    const directory = createFixture({ 'UI-decision.md': contents })

    expect(() => validateAdrDirectory(directory)).toThrow(
      `UI-decision.md: ${message}`
    )
  })

  test('accepts a dated or linked one-line Status', () => {
    const directory = createFixture({
      'UI-decision.md': adr(
        'UI-decision',
        '2026-01-01',
        'Accepted (2026-01-02)'
      ),
      'UX-decision.md': adr(
        'UX-decision',
        '2026-01-01',
        'Superseded by [ADR-UI-decision](UI-decision.md)'
      )
    })

    expect(() => validateAdrDirectory(directory)).not.toThrow()
  })

  test('accepts numbers that tell apart ADRs with the same name', () => {
    const directory = createFixture({
      'UI-0003-decision.md': adr('UI-0003-decision', '2026-01-01', 'Accepted'),
      'UI-0007-decision.md': adr('UI-0007-decision', '2026-01-02', 'Accepted')
    })

    expect(() => validateAdrDirectory(directory)).not.toThrow()
  })

  test('rejects a number on an ADR whose name is unique', () => {
    const directory = createFixture({
      'UI-0003-decision.md': adr('UI-0003-decision', '2026-01-01', 'Accepted')
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      'UI-0003-decision.md: no other ADR is named UI-decision; drop the sequence number'
    )
  })

  test('rejects an unnumbered ADR whose name another ADR shares', () => {
    const directory = createFixture({
      'UI-decision.md': adr('UI-decision', '2026-01-01', 'Accepted'),
      'UI-0007-decision.md': adr('UI-0007-decision', '2026-01-02', 'Accepted')
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      'UI-decision.md: 2 ADRs are named UI-decision; give each a sequence number'
    )
  })

  test('rejects an Accepted ADR that cites a Proposed one', () => {
    const directory = createFixture({
      'UI-decision.md': adr(
        'UI-decision',
        '2026-01-01',
        'Accepted',
        'Builds on [ADR-ECS-entity-component-system](ECS-entity-component-system.md).'
      )
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      'UI-decision.md: cites ADR-ECS-entity-component-system, which is still Proposed'
    )
  })

  test('does not read a longer identifier as a citation', () => {
    const directory = createFixture({
      'UI-plan.md': adr('UI-plan', '2026-01-01', 'Proposed'),
      'UI-plan-b.md': adr('UI-plan-b', '2026-01-01', 'Proposed'),
      'UI-decision.md': adr(
        'UI-decision',
        '2026-01-01',
        'Accepted',
        'Builds on ADR-UI-plan-b.'
      )
    })

    expect(() => validateAdrDirectory(directory)).toThrow(
      new Error(
        'ADR check failed:\nUI-decision.md: cites ADR-UI-plan-b, which is still Proposed; settle its status first'
      )
    )
  })

  test('allows a Proposed ADR to cite another Proposed ADR', () => {
    const directory = createFixture({
      'UI-decision.md': adr(
        'UI-decision',
        '2026-01-01',
        'Proposed',
        'Builds on ADR-ECS-entity-component-system.'
      )
    })

    expect(() => validateAdrDirectory(directory)).not.toThrow()
  })

  test('rejects a guidance file that cites a Proposed ADR', () => {
    expect(() =>
      validateAdrDirectory(createFixture(), [
        {
          filename: 'AGENTS.md',
          contents: 'Follow ADR-ECS-entity-component-system.'
        }
      ])
    ).toThrow(
      'AGENTS.md: cites ADR-ECS-entity-component-system, which is still Proposed'
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
