import { assert, describe, expect, it } from 'vitest'

import { buildBoundaries } from './boundaries'
import { matchesModulePath } from './records'
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
    allowedDependencies: [],
    allowedConsumers: [],
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
      patterns.some((pattern) => matchesModulePath(file, pattern))
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
      { path: 'src/images/model/**', role: 'domain' },
      { path: 'src/images/app/**', role: 'application' },
      { path: 'src/images/ui/**', role: 'presentation' }
    ],
    { publicEntryPoints: ['src/images/app/index.ts'], ...options }
  )
const editor = (options: Partial<DomainRecord> = {}) =>
  domain(
    'editor',
    [
      { path: 'src/editor/model/**', role: 'domain' },
      { path: 'src/editor/app/**', role: 'application' }
    ],
    options
  )
const approved = [
  images({ allowedConsumers: ['editor'] }),
  editor({ allowedDependencies: ['images'] })
]

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
      name: 'presentation may import application in its domain',
      records: [images()],
      from: 'src/images/ui/a.vue',
      to: 'src/images/app/store.ts',
      allowed: true
    },
    {
      name: 'application may not import presentation in its domain',
      records: [images()],
      from: 'src/images/app/store.ts',
      to: 'src/images/ui/a.vue',
      allowed: false
    },
    {
      name: 'a public entry point keeps its role direction',
      records: [images()],
      from: 'src/images/app/index.ts',
      to: 'src/images/ui/a.vue',
      allowed: false
    },
    {
      name: 'a domain needs reciprocal permission to use another domain',
      records: [images(), editor({ allowedDependencies: ['images'] })],
      from: 'src/editor/app/a.ts',
      to: 'src/images/app/index.ts',
      allowed: false
    },
    {
      name: 'an approved domain may import a public entry point',
      records: approved,
      from: 'src/editor/app/a.ts',
      to: 'src/images/app/index.ts',
      allowed: true
    },
    {
      name: 'an approved domain may not deep-import an enforced domain',
      records: approved,
      from: 'src/editor/app/a.ts',
      to: 'src/images/app/store.ts',
      allowed: false
    },
    {
      name: 'role direction applies across approved domains',
      records: approved,
      from: 'src/editor/model/a.ts',
      to: 'src/images/app/index.ts',
      allowed: false
    }
  ])('$name', ({ records, from, to, allowed }) => {
    expect(fallowAllows(records, from, to)).toBe(allowed)
  })
})
