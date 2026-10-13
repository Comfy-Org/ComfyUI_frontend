import { describe, expect, it } from 'vitest'

import type { ArchitectureException } from './schema'
import { findSuppressions, ledgerErrors } from './suppressions'

const fingerprints = (filename: string, source: string) =>
  findSuppressions(filename, source).map(({ fingerprint }) => fingerprint)

describe('findSuppressions', () => {
  it.for([
    {
      name: 'a rule-specific ESLint disable',
      comment: '// eslint-disable-next-line comfy/no-restricted-paths',
      expected: ['anonymous-suppression:src/a.ts:comfy/no-restricted-paths#1']
    },
    {
      name: 'a blanket ESLint disable',
      comment: '/* eslint-disable */',
      expected: ['anonymous-suppression:src/a.ts:comfy/no-restricted-paths#1']
    },
    {
      name: 'a multiline oxlint rule list',
      comment:
        '/* oxlint-disable-next-line\n * no-console, comfy/no-restricted-paths\n */',
      expected: ['anonymous-suppression:src/a.ts:comfy/no-restricted-paths#1']
    },
    {
      name: 'a disable for another rule',
      comment: '// eslint-disable-next-line no-console',
      expected: []
    },
    {
      name: 'a Fallow boundary ignore',
      comment: '// fallow-ignore-next-line boundary-violation -- legacy caller',
      expected: ['anonymous-suppression:src/a.ts:boundary-violation#1']
    },
    {
      name: 'a blanket Fallow file ignore',
      comment: '// fallow-ignore-file',
      expected: ['anonymous-suppression:src/a.ts:boundary-violation#1']
    },
    {
      name: 'a Fallow ignore for another issue',
      comment: '// fallow-ignore-next-line complexity -- legacy importer',
      expected: []
    },
    {
      name: 'a named exception',
      comment:
        '// fallow-ignore-next-line boundary-violation -- architecture-exception: DDD-EX-042',
      expected: ['named-suppression:DDD-EX-042:src/a.ts:boundary-violation#1']
    }
  ])('records $name', ({ comment, expected }) => {
    expect(fingerprints('src/a.ts', `${comment}\nexport const a = 1`)).toEqual(
      expected
    )
  })

  it('ignores directive text outside comments and Vue script blocks', () => {
    const source = [
      '<template><!-- eslint-disable --></template>',
      '<script setup lang="ts">',
      'const pattern = /[/*] eslint-disable */',
      'const text = `fallow-ignore-file`',
      '// eslint-disable-next-line comfy/no-restricted-paths',
      'const value = 1',
      '</script>'
    ].join('\n')
    expect(fingerprints('src/a.vue', source)).toEqual([
      'anonymous-suppression:src/a.vue:comfy/no-restricted-paths#1'
    ])
  })

  it('numbers occurrences per fingerprint base', () => {
    const source = [
      '// eslint-disable-next-line comfy/no-restricted-paths',
      '// eslint-disable-next-line comfy/no-restricted-paths -- architecture-exception: DDD-EX-001',
      '// fallow-ignore-next-line boundary-violation',
      '// eslint-disable-next-line comfy/no-restricted-paths',
      'export const a = 1'
    ].join('\n')
    expect(fingerprints('src/a.ts', source)).toEqual([
      'anonymous-suppression:src/a.ts:comfy/no-restricted-paths#1',
      'named-suppression:DDD-EX-001:src/a.ts:comfy/no-restricted-paths#1',
      'anonymous-suppression:src/a.ts:boundary-violation#1',
      'anonymous-suppression:src/a.ts:comfy/no-restricted-paths#2'
    ])
  })
})

describe('ledgerErrors', () => {
  const exception = (
    id: string,
    exactFingerprints: string[]
  ): ArchitectureException => ({
    id,
    owner: '@owner',
    rationale: 'Fixture debt',
    sunset: '2027-01-01',
    removalCriteria: 'Remove the suppression',
    exactFingerprints
  })
  const anonymous = 'anonymous-suppression:src/a.ts:boundary-violation#1'
  const named = 'named-suppression:DDD-EX-002:src/a.ts:boundary-violation#1'

  it.for([
    {
      name: 'accepts suppressions listed once',
      suppressions: [{ fingerprint: anonymous, source: 'src/a.ts' }],
      exceptions: [exception('DDD-EX-001', [anonymous])],
      expected: []
    },
    {
      name: 'rejects a new suppression',
      suppressions: [{ fingerprint: anonymous, source: 'src/a.ts' }],
      exceptions: [],
      expected: [`${anonymous} is a new architecture suppression`]
    },
    {
      name: 'rejects a suppression listed twice',
      suppressions: [{ fingerprint: anonymous, source: 'src/a.ts' }],
      exceptions: [
        exception('DDD-EX-001', [anonymous]),
        exception('DDD-EX-002', [anonymous])
      ],
      expected: [`${anonymous} is listed by more than one exception`]
    },
    {
      name: 'rejects a named suppression listed by another exception',
      suppressions: [
        { exceptionId: 'DDD-EX-002', fingerprint: named, source: 'src/a.ts' }
      ],
      exceptions: [exception('DDD-EX-001', [named])],
      expected: [`${named} names DDD-EX-002 but is listed by DDD-EX-001`]
    },
    {
      name: 'rejects a listed suppression that no longer exists',
      suppressions: [],
      exceptions: [exception('DDD-EX-001', [anonymous])],
      expected: [`DDD-EX-001 lists ${anonymous}, which no longer exists`]
    }
  ])('$name', ({ suppressions, exceptions, expected }) => {
    expect(ledgerErrors(suppressions, exceptions)).toEqual(
      expected.map((message) => expect.stringContaining(message))
    )
  })
})
