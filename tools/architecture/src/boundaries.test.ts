import { matchesGlob } from 'node:path'

import { assert, describe, expect, it } from 'vitest'

import { buildBoundaries } from './boundaries'
import type { DomainRecord } from './schema'

function domain(
  id: string,
  modules: DomainRecord['modules'],
  options: Partial<DomainRecord> = {}
): DomainRecord {
  return {
    id,
    capability: id,
    description: `${id} fixture`,
    modules,
    publicEntryPoints: [],
    characterizationScenarios: [{ name: 'contract', checks: ['x.test.ts'] }],
    adrs: [],
    compatibilityPromises: ['keeps its contract'],
    deepImports: 'enforced',
    ...options
  }
}

function fallowAllows(records: DomainRecord[], from: string, to: string) {
  const { zones, rules } = buildBoundaries(records).boundaries
  const zoneOf = (file: string) =>
    zones.find(({ patterns }) =>
      patterns.some((pattern) => matchesGlob(file, pattern))
    )?.name
  const rule = rules.find(({ from: zone }) => zone === zoneOf(from))
  const target = zoneOf(to)
  assert.exists(rule)
  assert.exists(target)
  return rule.allow.includes(target)
}

const images = (options: Partial<DomainRecord> = {}) =>
  domain(
    'images',
    [
      { path: 'src/images/model/**' },
      { path: 'src/images/app/**' },
      { path: 'src/images/ui/**' }
    ],
    { publicEntryPoints: ['src/images/app/index.ts'], ...options }
  )
const editor = (options: Partial<DomainRecord> = {}) =>
  domain(
    'editor',
    [{ path: 'src/editor/model/**' }, { path: 'src/editor/app/**' }],
    options
  )
const both = [images(), editor()]

describe('buildBoundaries', () => {
  it.for([
    {
      name: 'unclassified code may not deep-import an enforced domain',
      records: [images()],
      from: 'src/legacy/a.ts',
      to: 'src/images/app/store.ts',
      allowed: false
    },
    {
      name: 'unclassified package code may not deep-import an enforced domain',
      records: [images()],
      from: 'packages/widgets/src/a.ts',
      to: 'src/images/app/store.ts',
      allowed: false
    },
    {
      name: 'unclassified tooling may not deep-import an enforced domain',
      records: [images()],
      from: 'tools/widgets/src/a.ts',
      to: 'src/images/app/store.ts',
      allowed: false
    },
    {
      name: 'unclassified code may deep-import an inventory domain',
      records: [images({ deepImports: 'inventory' })],
      from: 'src/legacy/a.ts',
      to: 'src/images/app/store.ts',
      allowed: true
    },
    {
      name: 'unclassified code may import a public entry point',
      records: [images()],
      from: 'src/legacy/a.ts',
      to: 'src/images/app/index.ts',
      allowed: true
    },
    {
      name: 'domain code may import unclassified code',
      records: [images()],
      from: 'src/images/model/a.ts',
      to: 'src/legacy/a.ts',
      allowed: true
    },
    {
      name: 'any file may import any other file in its domain',
      records: [images()],
      from: 'src/images/app/store.ts',
      to: 'src/images/ui/a.vue',
      allowed: true
    },
    {
      name: 'another domain may import a public entry point',
      records: both,
      from: 'src/editor/app/a.ts',
      to: 'src/images/app/index.ts',
      allowed: true
    },
    {
      name: 'another domain may deep-import an inventory domain',
      records: [images({ deepImports: 'inventory' }), editor()],
      from: 'src/editor/app/a.ts',
      to: 'src/images/app/store.ts',
      allowed: true
    },
    {
      name: 'another domain may not deep-import an enforced domain',
      records: both,
      from: 'src/editor/app/a.ts',
      to: 'src/images/app/store.ts',
      allowed: false
    },
    {
      name: 'a nested directory claims its files from the enclosing directory',
      records: [
        images(),
        domain('viewer', [{ path: 'src/images/ui/viewer/**' }])
      ],
      from: 'src/images/ui/viewer/a.vue',
      to: 'src/images/app/store.ts',
      allowed: false
    },
    {
      name: 'a file path claims its file from a directory nested inside its own domain',
      records: [
        domain('viewer', [{ path: 'src/images/ui/viewer/**' }]),
        images({
          modules: [
            ...images().modules,
            { path: 'src/images/ui/viewer/legacy.ts' }
          ]
        })
      ],
      from: 'src/images/ui/viewer/legacy.ts',
      to: 'src/images/app/store.ts',
      allowed: true
    },
    {
      name: 'an enforced domain named inventory stays closed to deep imports',
      records: [
        images({ deepImports: 'inventory' }),
        domain('inventory', [{ path: 'src/stock/**' }])
      ],
      from: 'src/legacy/a.ts',
      to: 'src/stock/store.ts',
      allowed: false
    }
  ])('$name', ({ records, from, to, allowed }) => {
    expect(fallowAllows(records, from, to)).toBe(allowed)
  })
})
