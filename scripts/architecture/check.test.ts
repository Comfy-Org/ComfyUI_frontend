import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ArchitectureException, DomainRecord, Violation } from './check'
import {
  censusRepository,
  findRatchetFailures,
  loadArchitectureConfiguration,
  parseImportSpecifiers,
  runArchitectureCheck,
  validateExceptionCoverage
} from './check'

const temporaryDirectories: string[] = []
let dateNowSpy: ReturnType<typeof vi.spyOn>
const createRepository = (files: Record<string, string>): string => {
  const root = join(
    tmpdir(),
    `comfyui-architecture-${process.pid}-${temporaryDirectories.length}`
  )
  temporaryDirectories.push(root)
  for (const [filename, contents] of Object.entries(files)) {
    mkdirSync(join(root, filename, '..'), { recursive: true })
    writeFileSync(join(root, filename), contents)
  }
  return root
}

const domain = (
  id: string,
  paths: string[],
  options: Partial<DomainRecord> = {}
): DomainRecord => ({
  schemaVersion: 1,
  id,
  capability: id,
  description: `${id} fixture`,
  expectedFileCount: 1,
  modules: paths.map((path) => ({ path, role: 'domain' })),
  publicEntryPoints: [],
  owners: ['@owner'],
  allowedDependencies: [],
  allowedConsumers: [],
  characterizationScenarios: [
    { name: 'keeps its contract', checks: ['src/check.test.ts'] }
  ],
  adrs: [],
  compatibilityPromises: ['keeps its fixture contract'],
  enforcement: { deepImports: 'baseline', dependencies: 'error' },
  ...options
})

const exception = (
  options: Partial<ArchitectureException> = {}
): ArchitectureException => ({
  exactFingerprints: [],
  id: 'DDD-EX-001',
  owner: '@owner',
  rationale: 'Fixture debt',
  sunset: '2027-01-01',
  removalCriteria: 'Classify the fixture',
  fingerprintPrefixes: ['unclassified-module:'],
  ...options
})

const createConfiguredRepository = (): string => {
  const record = domain('images', ['src/domains/images/**'], {
    publicEntryPoints: ['src/domains/images/index.ts']
  })
  return createRepository({
    CODEOWNERS: '/src/domains/images/ @owner\n',
    'src/domains/images/index.ts': 'export const value = 1',
    'src/check.test.ts': 'export const check = true',
    'docs/architecture/domains/records/images.domain.json':
      JSON.stringify(record),
    'docs/architecture/domains/exceptions.json': JSON.stringify({
      $schema: './exceptions.schema.json',
      schemaVersion: 1,
      exceptions: [
        exception({ fingerprintPrefixes: ['anonymous-suppression:'] })
      ]
    }),
    'docs/architecture/domains/baseline.json': JSON.stringify({
      schemaVersion: 1,
      violations: []
    })
  })
}

beforeEach(() => {
  dateNowSpy = vi
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2026-10-01T00:00:00Z'))
})

afterEach(() => {
  dateNowSpy.mockRestore()
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true })
})

describe('parseImportSpecifiers', () => {
  test('uses syntax nodes for static, exported, and dynamic imports', () => {
    expect(
      parseImportSpecifiers(
        'source.ts',
        [
          "import value from './static'",
          "export { other } from './exported'",
          "const lazy = import('./dynamic')",
          'const text = "import(\'./not-code\')"'
        ].join('\n')
      )
    ).toEqual(['./static', './exported', './dynamic'])
  })

  test('parses imports from Vue script blocks only', () => {
    expect(
      parseImportSpecifiers(
        'Component.vue',
        [
          '<template>import("./template-text")</template>',
          '<script setup lang="ts">',
          "import value from './script'",
          '</script>'
        ].join('\n')
      )
    ).toEqual(['./script'])
  })

  test('parses TypeScript generics without treating them as JSX', () => {
    const source = [
      'const identity = <T>(value: T) => value',
      "const lazy = import('./dynamic')"
    ].join('\n')
    expect(parseImportSpecifiers('generic.ts', source)).toEqual(['./dynamic'])
    expect(
      parseImportSpecifiers(
        'generic.vue',
        `<script lang="ts">${source}</script>`
      )
    ).toEqual(['./dynamic'])
  })
})

describe('censusRepository', () => {
  test('reports outside callers as legacy deep imports', () => {
    const root = createRepository({
      'src/domains/images/index.ts': "export { value } from './internal'",
      'src/domains/images/internal.ts': 'export const value = 1',
      'src/consumer.ts': "import { value } from '@/domains/images/internal'"
    })
    const census = censusRepository(root, [
      domain('images', ['src/domains/images/**'], {
        publicEntryPoints: ['src/domains/images/index.ts']
      })
    ])

    expect(census.violations.map(({ fingerprint }) => fingerprint)).toEqual([
      'deep-import:images:src/consumer.ts->src/domains/images/internal.ts#1',
      'unclassified-module:src/consumer.ts'
    ])
    expect(
      census.edges.find(({ source }) => source === 'src/consumer.ts')
        ?.classification
    ).toBe('legacy')
  })

  test('allows an outside caller to use a declared public entry point', () => {
    const root = createRepository({
      'src/domains/images/index.ts': 'export const value = 1',
      'src/consumer.ts': "import { value } from '@/domains/images'"
    })
    const census = censusRepository(root, [
      domain('images', ['src/domains/images/**'], {
        publicEntryPoints: ['src/domains/images/index.ts']
      })
    ])

    expect(census.violations.map(({ fingerprint }) => fingerprint)).toEqual([
      'unclassified-module:src/consumer.ts'
    ])
    expect(census.edges[0]?.classification).toBe('allowed')
  })

  test('requires reciprocal permission for cross-domain dependencies', () => {
    const root = createRepository({
      'src/domains/alpha/index.ts': "import { value } from '@/domains/beta'",
      'src/domains/beta/index.ts': 'export const value = 1'
    })
    const census = censusRepository(root, [
      domain('alpha', ['src/domains/alpha/**']),
      domain('beta', ['src/domains/beta/**'], {
        publicEntryPoints: ['src/domains/beta/index.ts']
      })
    ])

    expect(census.violations.map(({ kind }) => kind)).toEqual([
      'forbidden-edge'
    ])
    expect(census.edges[0]?.classification).toBe('forbidden')
  })

  test('classifies reciprocally approved public domain edges as allowed', () => {
    const root = createRepository({
      'src/domains/alpha/index.ts': "import { value } from '@/domains/beta'",
      'src/domains/beta/index.ts': 'export const value = 1'
    })
    const census = censusRepository(root, [
      domain('alpha', ['src/domains/alpha/**'], {
        allowedDependencies: ['beta']
      }),
      domain('beta', ['src/domains/beta/**'], {
        allowedConsumers: ['alpha'],
        publicEntryPoints: ['src/domains/beta/index.ts']
      })
    ])

    expect(census.violations).toEqual([])
    expect(census.edges[0]?.classification).toBe('allowed')
  })

  test('enforces architectural role direction within a capability', () => {
    const root = createRepository({
      'src/domains/images/domain.ts':
        "import { view } from './presentation'\nexport const model = view",
      'src/domains/images/presentation.ts': 'export const view = 1'
    })
    const record = domain('images', [], {
      expectedFileCount: 2,
      modules: [
        { path: 'src/domains/images/domain.ts', role: 'domain' },
        {
          path: 'src/domains/images/presentation.ts',
          role: 'presentation'
        }
      ]
    })
    const census = censusRepository(root, [record])
    expect(census.edges[0]).toMatchObject({
      classification: 'forbidden',
      sourceRole: 'domain',
      targetRole: 'presentation'
    })
    expect(census.violations.map(({ kind }) => kind)).toEqual([
      'forbidden-edge'
    ])
  })
})

describe('censusRepository accounting and suppressions', () => {
  test('allows presentation to depend on application within a capability', () => {
    const root = createRepository({
      'src/domains/images/application.ts': 'export const useImages = 1',
      'src/domains/images/presentation.ts':
        "import { useImages } from './application'\nexport const view = useImages"
    })
    const record = domain('images', [], {
      expectedFileCount: 2,
      modules: [
        { path: 'src/domains/images/application.ts', role: 'application' },
        {
          path: 'src/domains/images/presentation.ts',
          role: 'presentation'
        }
      ]
    })
    const census = censusRepository(root, [record])
    expect(census.edges[0]).toMatchObject({
      classification: 'allowed',
      sourceRole: 'presentation',
      targetRole: 'application'
    })
    expect(census.violations).toEqual([])
  })

  test('preserves duplicate declaration occurrences and distinct sources', () => {
    const root = createRepository({
      'src/domains/images/internal.ts': 'export const value = 1',
      'src/consumer.ts': [
        "import { value } from '@/domains/images/internal'",
        "const lazy = import('@/domains/images/internal')"
      ].join('\n')
    })
    const census = censusRepository(root, [
      domain('images', ['src/domains/images/**'])
    ])

    expect(
      census.violations
        .filter(({ kind }) => kind === 'deep-import')
        .map(({ fingerprint }) => fingerprint)
    ).toEqual([
      'deep-import:images:src/consumer.ts->src/domains/images/internal.ts#1',
      'deep-import:images:src/consumer.ts->src/domains/images/internal.ts#2'
    ])
    expect(census.resolvedInternalDeclarations).toBe(2)
    expect(census.resolvedInternalSources).toBe(1)
  })

  test('does not count packages or unresolved aliases as internal edges', () => {
    const root = createRepository({
      'src/domain.ts':
        "import { ref } from 'vue'\nimport missing from '@/missing'"
    })
    const census = censusRepository(root, [])
    expect(census.parsedDeclarations).toBe(2)
    expect(census.resolvedInternalDeclarations).toBe(0)
    expect(census.unresolvedInternal).toEqual([
      { source: 'src/domain.ts', specifier: '@/missing' }
    ])
    expect(census.edges).toEqual([])
  })

  test('resolves internal imports with bundler query suffixes', () => {
    const root = createRepository({
      'src/asset.ts': 'export const asset = true',
      'src/consumer.ts': "import asset from '@/asset?raw'"
    })
    const census = censusRepository(root, [])
    expect(census.resolvedInternalDeclarations).toBe(1)
    expect(census.unresolvedInternal).toEqual([])
  })

  test('retains named and anonymous layer suppressions as violations', () => {
    const root = createRepository({
      'src/anonymous.ts':
        '// eslint-disable-next-line import-x/no-restricted-paths\nexport const anonymous = true',
      'src/owned.ts':
        '// eslint-disable-next-line import-x/no-restricted-paths -- architecture-exception: DDD-EX-042\nexport const owned = true'
    })
    const census = censusRepository(root, [])
    expect(census.violations.map(({ fingerprint }) => fingerprint)).toEqual([
      'anonymous-suppression:src/anonymous.ts:import-x/no-restricted-paths#1',
      'named-suppression:DDD-EX-042:src/owned.ts:import-x/no-restricted-paths#1',
      'unclassified-module:src/anonymous.ts',
      'unclassified-module:src/owned.ts'
    ])
  })

  test('numbers suppression occurrences independently per fingerprint base', () => {
    const root = createRepository({
      'src/mixed.ts': [
        '// eslint-disable-next-line import-x/no-restricted-paths',
        '// eslint-disable-next-line import-x/no-restricted-paths -- architecture-exception: DDD-EX-001',
        '// eslint-disable-next-line import-x/no-restricted-paths -- architecture-exception: DDD-EX-002',
        '// eslint-disable-next-line import-x/no-restricted-paths',
        '// eslint-disable-next-line import-x/no-restricted-paths -- architecture-exception: DDD-EX-001',
        'export const mixed = true'
      ].join('\n')
    })
    const census = censusRepository(root, [])
    expect(
      census.violations
        .filter(({ kind }) => kind.endsWith('suppression'))
        .map(({ fingerprint }) => fingerprint)
    ).toEqual([
      'anonymous-suppression:src/mixed.ts:import-x/no-restricted-paths#1',
      'anonymous-suppression:src/mixed.ts:import-x/no-restricted-paths#2',
      'named-suppression:DDD-EX-001:src/mixed.ts:import-x/no-restricted-paths#1',
      'named-suppression:DDD-EX-001:src/mixed.ts:import-x/no-restricted-paths#2',
      'named-suppression:DDD-EX-002:src/mixed.ts:import-x/no-restricted-paths#1'
    ])
  })

  test('detects blanket, multiline, and bulk architecture suppressions', () => {
    const root = createRepository({
      'src/suppressions.ts': [
        '/* eslint-disable */',
        '/* eslint-disable-next-line\n * import-x/no-restricted-paths, no-console\n */',
        '// eslint-disable-line no-console, import-x/no-restricted-paths',
        '// eslint-disable-next-line no-console'
      ].join('\n')
    })
    const census = censusRepository(root, [])
    expect(
      census.violations.filter(({ kind }) => kind === 'anonymous-suppression')
    ).toHaveLength(3)
  })

  test('rejects overlapping capability-role ownership', () => {
    const root = createRepository({
      'src/domains/images/index.ts': 'export const value = 1'
    })
    expect(() =>
      censusRepository(root, [
        domain('images', ['src/domains/images/**']),
        domain('media', ['src/domains/**'])
      ])
    ).toThrow('owned by overlapping domains')
  })
})

describe('configuration validation', () => {
  test('rejects extra domain fields', () => {
    const root = createConfiguredRepository()
    const filename = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const value = JSON.parse(readFileSync(filename, 'utf8'))
    writeFileSync(filename, JSON.stringify({ ...value, undocumented: true }))
    expect(() => loadArchitectureConfiguration(root)).toThrow('invalid fields')
  })

  test('rejects unknown dependency identifiers', () => {
    const root = createConfiguredRepository()
    const filename = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const value = JSON.parse(readFileSync(filename, 'utf8'))
    writeFileSync(
      filename,
      JSON.stringify({ ...value, allowedDependencies: ['missing-domain'] })
    )
    expect(() => loadArchitectureConfiguration(root)).toThrow(
      'references unknown domain'
    )
  })
})

describe('configuration filesystem validation', () => {
  test('rejects unmatched module paths and CODEOWNERS drift', () => {
    const unmatched = createConfiguredRepository()
    const filename = join(
      unmatched,
      'docs/architecture/domains/records/images.domain.json'
    )
    const value = JSON.parse(readFileSync(filename, 'utf8'))
    writeFileSync(
      filename,
      JSON.stringify({
        ...value,
        modules: [{ path: 'src/missing/**', role: 'domain' }]
      })
    )
    expect(() => loadArchitectureConfiguration(unmatched)).toThrow(
      'matches no source files'
    )

    const ownership = createConfiguredRepository()
    writeFileSync(
      join(ownership, 'CODEOWNERS'),
      '/src/domains/images/ @other\n'
    )
    expect(() => loadArchitectureConfiguration(ownership)).toThrow(
      'owners differ from CODEOWNERS'
    )
  })

  test('rejects domain path-population drift', () => {
    const root = createConfiguredRepository()
    const filename = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const value = JSON.parse(readFileSync(filename, 'utf8'))
    writeFileSync(filename, JSON.stringify({ ...value, expectedFileCount: 2 }))

    expect(() => loadArchitectureConfiguration(root)).toThrow(
      'expected 2 files but matched 1'
    )
  })

  test('rejects overlapping module roles inside one domain', () => {
    const root = createConfiguredRepository()
    const recordPath = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    record.modules.push({
      path: 'src/domains/images/index.ts',
      role: 'presentation'
    })
    writeFileSync(recordPath, JSON.stringify(record))
    expect(() => loadArchitectureConfiguration(root)).toThrow(
      'overlapping module paths'
    )
  })
})

describe('baseline and exception controls', () => {
  const violation = (fingerprint: string): Violation => ({
    kind: 'unclassified-module',
    fingerprint,
    detail: fingerprint,
    maturity: 'baseline',
    source: fingerprint
  })

  test('allows recorded debt and rejects baseline growth', () => {
    const existing = violation('unclassified-module:existing')
    const added = violation('unclassified-module:added')
    expect(
      findRatchetFailures([existing, added], [existing.fingerprint])
    ).toEqual([added])
  })

  test('requires exactly one owned exception per baseline violation', () => {
    const current = violation('unclassified-module:src/new.ts')
    expect(() => validateExceptionCoverage([current], [])).toThrow(
      'exactly one owned exception'
    )
    expect(() =>
      validateExceptionCoverage([current], [exception(), exception()])
    ).toThrow('exactly one owned exception')
    expect(() =>
      validateExceptionCoverage([current], [exception()])
    ).not.toThrow()
  })

  test('requires a named suppression to be owned by the exception it names', () => {
    const named: Violation = {
      ...violation(
        'named-suppression:DDD-EX-001:src/owned.ts:import-x/no-restricted-paths#1'
      ),
      exceptionId: 'DDD-EX-001',
      kind: 'named-suppression'
    }
    const wrongExistingId = exception({
      id: 'DDD-EX-001',
      fingerprintPrefixes: ['unclassified-module:']
    })
    const accidentalOwner = exception({
      id: 'DDD-EX-004',
      fingerprintPrefixes: ['named-suppression:']
    })
    expect(() =>
      validateExceptionCoverage([named], [wrongExistingId, accidentalOwner])
    ).toThrow('names DDD-EX-001, but is owned by DDD-EX-004')

    const exactOwner = exception({
      id: 'DDD-EX-001',
      exactFingerprints: [named.fingerprint],
      fingerprintPrefixes: []
    })
    expect(() => validateExceptionCoverage([named], [exactOwner])).not.toThrow()
  })
})

describe('baseline admission and catalog stability', () => {
  test('acceptance requires exact coverage instead of a historical prefix', () => {
    const root = createConfiguredRepository()
    runArchitectureCheck(root, 'update')
    writeFileSync(
      join(root, 'src/new.ts'),
      '// eslint-disable-next-line import-x/no-restricted-paths\nexport const added = true'
    )
    expect(() => runArchitectureCheck(root, 'update')).toThrow(
      'architecture:accept-baseline'
    )
    expect(() => runArchitectureCheck(root, 'accept-baseline')).toThrow(
      'requires exact owned exception coverage'
    )
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions[0].exactFingerprints.push(
      'anonymous-suppression:src/new.ts:import-x/no-restricted-paths#1'
    )
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    runArchitectureCheck(root, 'accept-baseline')
    expect(
      JSON.parse(
        readFileSync(
          join(root, 'docs/architecture/domains/baseline.json'),
          'utf8'
        )
      ).violations
    ).toContain(
      'anonymous-suppression:src/new.ts:import-x/no-restricted-paths#1'
    )
  })

  test('rejects expired exception sunsets', () => {
    const root = createConfiguredRepository()
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions[0].sunset = '2000-01-01'
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    expect(() => loadArchitectureConfiguration(root)).toThrow('is expired')
  })

  test('stable catalog ignores live census churn', () => {
    const root = createConfiguredRepository()
    runArchitectureCheck(root, 'update')
    const filename = join(root, 'docs/architecture/domains/catalog.json')
    const before = readFileSync(filename, 'utf8')
    writeFileSync(
      join(root, 'src/domains/images/index.ts'),
      "export { check } from '../../check.test'"
    )
    runArchitectureCheck(root, 'update')
    expect(readFileSync(filename, 'utf8')).toBe(before)
  })

  test('catalog checks tolerate formatter-only JSON layout changes', () => {
    const root = createConfiguredRepository()
    runArchitectureCheck(root, 'update')
    const filename = join(root, 'docs/architecture/domains/catalog.json')
    const catalog = JSON.parse(readFileSync(filename, 'utf8'))
    writeFileSync(filename, JSON.stringify(catalog))
    expect(() => runArchitectureCheck(root, 'check')).not.toThrow()
  })

  test('check rejects stale debt and update removes it from the baseline', () => {
    const root = createConfiguredRepository()
    const baselinePath = join(root, 'docs/architecture/domains/baseline.json')
    writeFileSync(
      baselinePath,
      JSON.stringify({
        schemaVersion: 1,
        violations: [
          'anonymous-suppression:src/resolved.ts:import-x/no-restricted-paths#1'
        ]
      })
    )
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions[0].exactFingerprints.push(
      'anonymous-suppression:src/resolved.ts:import-x/no-restricted-paths#1'
    )
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    expect(() => runArchitectureCheck(root, 'check')).toThrow(
      'run pnpm architecture:update'
    )
    runArchitectureCheck(root, 'update')
    expect(JSON.parse(readFileSync(baselinePath, 'utf8')).violations).toEqual(
      []
    )
  })

  test('check rejects a manually baselined fingerprint without exact ownership', () => {
    const root = createConfiguredRepository()
    const recordPath = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    record.publicEntryPoints = []
    record.enforcement.deepImports = 'baseline'
    writeFileSync(recordPath, JSON.stringify(record))
    const fingerprint =
      'deep-import:images:src/consumer.ts->src/domains/images/index.ts#1'
    const baselinePath = join(root, 'docs/architecture/domains/baseline.json')
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions[0].fingerprintPrefixes = ['deep-import:images:']
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    runArchitectureCheck(root, 'update')
    writeFileSync(
      join(root, 'src/consumer.ts'),
      "import { value } from '@/domains/images/index'"
    )
    writeFileSync(
      baselinePath,
      JSON.stringify({ schemaVersion: 1, violations: [fingerprint] })
    )
    expect(() => runArchitectureCheck(root, 'check')).toThrow(
      'requires exact owned exception coverage'
    )
  })
})
