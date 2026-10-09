import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

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
const createRepository = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'comfyui-architecture-'))
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
      exceptions: []
    }),
    'docs/architecture/domains/baseline.json': JSON.stringify({
      schemaVersion: 1,
      violations: []
    })
  })
}

afterEach(() => {
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

describe('architecture suppression parsing', () => {
  test('ignores comment-like text in templates and regular expressions', () => {
    const root = createConfiguredRepository()
    writeFileSync(
      join(root, 'src/template.ts'),
      [
        'export const template = `x${value}y`',
        'export const pattern = /[/*] eslint-disable */',
        '// eslint-disable-next-line comfy/no-restricted-paths',
        'export const value = true'
      ].join('\n')
    )
    expect(
      censusRepository(root, loadArchitectureConfiguration(root).records)
        .violations.filter(({ kind }) => kind === 'anonymous-suppression')
        .map(({ fingerprint }) => fingerprint)
    ).toEqual([
      'anonymous-suppression:src/template.ts:comfy/no-restricted-paths#1'
    ])
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

    expect(
      census.violations.map(({ kind, maturity }) => ({ kind, maturity }))
    ).toEqual([{ kind: 'forbidden-edge', maturity: 'error' }])
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

  test('enforces architectural role direction across approved domains', () => {
    const root = createRepository({
      'src/domains/alpha/index.ts': "import { value } from '@/domains/beta'",
      'src/domains/beta/index.ts': 'export const value = 1'
    })
    const census = censusRepository(root, [
      domain('alpha', ['src/domains/alpha/**'], {
        allowedDependencies: ['beta']
      }),
      domain('beta', [], {
        allowedConsumers: ['alpha'],
        modules: [{ path: 'src/domains/beta/**', role: 'presentation' }],
        publicEntryPoints: ['src/domains/beta/index.ts']
      })
    ])
    expect(census.violations.map(({ kind }) => kind)).toEqual([
      'forbidden-edge'
    ])
  })

  test('enforces architectural role direction within a capability', () => {
    const root = createRepository({
      'src/domains/images/domain.ts':
        "import { view } from './presentation'\nexport const model = view",
      'src/domains/images/presentation.ts': 'export const view = 1'
    })
    const record = domain('images', [], {
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
    expect(census.resolvedInternalSources).toBe(1)
  })

  test('does not count packages or unresolved aliases as internal edges', () => {
    const root = createRepository({
      'src/domain.ts':
        "import { ref } from 'vue'\nimport missing from '@/missing'"
    })
    const census = censusRepository(root, [])
    expect(census.parsedDeclarations).toBe(2)
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
  })

  test('retains named and anonymous layer suppressions as violations', () => {
    const root = createRepository({
      'src/anonymous.ts':
        '// eslint-disable-next-line comfy/no-restricted-paths\nexport const anonymous = true',
      'src/owned.ts':
        '// eslint-disable-next-line comfy/no-restricted-paths -- architecture-exception: DDD-EX-042\nexport const owned = true'
    })
    const census = censusRepository(root, [])
    expect(census.violations.map(({ fingerprint }) => fingerprint)).toEqual([
      'anonymous-suppression:src/anonymous.ts:comfy/no-restricted-paths#1',
      'named-suppression:DDD-EX-042:src/owned.ts:comfy/no-restricted-paths#1',
      'unclassified-module:src/anonymous.ts',
      'unclassified-module:src/owned.ts'
    ])
  })

  test('numbers suppression occurrences independently per fingerprint base', () => {
    const root = createRepository({
      'src/mixed.ts': [
        '// eslint-disable-next-line comfy/no-restricted-paths',
        '// eslint-disable-next-line comfy/no-restricted-paths -- architecture-exception: DDD-EX-001',
        '// eslint-disable-next-line comfy/no-restricted-paths -- architecture-exception: DDD-EX-002',
        '// eslint-disable-next-line comfy/no-restricted-paths',
        '// eslint-disable-next-line comfy/no-restricted-paths -- architecture-exception: DDD-EX-001',
        'export const mixed = true'
      ].join('\n')
    })
    const census = censusRepository(root, [])
    expect(
      census.violations
        .filter(({ kind }) => kind.endsWith('suppression'))
        .map(({ fingerprint }) => fingerprint)
    ).toEqual([
      'anonymous-suppression:src/mixed.ts:comfy/no-restricted-paths#1',
      'anonymous-suppression:src/mixed.ts:comfy/no-restricted-paths#2',
      'named-suppression:DDD-EX-001:src/mixed.ts:comfy/no-restricted-paths#1',
      'named-suppression:DDD-EX-001:src/mixed.ts:comfy/no-restricted-paths#2',
      'named-suppression:DDD-EX-002:src/mixed.ts:comfy/no-restricted-paths#1'
    ])
  })

  test.for([
    { name: 'blanket', comment: '/* eslint-disable */', count: 1 },
    {
      name: 'multiline rule list',
      comment:
        '/* eslint-disable-next-line\n * comfy/no-restricted-paths, no-console\n */',
      count: 1
    },
    {
      name: 'bulk rule list',
      comment: '// eslint-disable-line no-console, comfy/no-restricted-paths',
      count: 1
    },
    {
      name: 'other-rule-only',
      comment: '// eslint-disable-next-line no-console',
      count: 0
    }
  ])('counts a $name suppression $count time(s)', ({ comment, count }) => {
    const root = createRepository({
      'src/suppressions.ts': `${comment}\nexport const value = 1`
    })
    expect(
      censusRepository(root, []).violations.filter(
        ({ kind }) => kind === 'anonymous-suppression'
      )
    ).toHaveLength(count)
  })

  test('rejects a source file owned by two domains', () => {
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

  test('rejects inline references to unknown exceptions', () => {
    const root = createConfiguredRepository()
    writeFileSync(
      join(root, 'src/unknown.ts'),
      '// eslint-disable-next-line no-console -- architecture-exception: DDD-EX-999\nexport const unknown = true'
    )
    expect(() => loadArchitectureConfiguration(root)).toThrow(
      'references unknown exception DDD-EX-999'
    )
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

  test('rejects duplicate exception ids', () => {
    const root = createConfiguredRepository()
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions.push(
      exception({ exactFingerprints: ['first'] }),
      exception({ exactFingerprints: ['second'] })
    )
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    expect(() => loadArchitectureConfiguration(root)).toThrow(
      'Exception ids must be unique'
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
    kind: 'anonymous-suppression',
    fingerprint,
    detail: fingerprint,
    maturity: 'baseline',
    source: fingerprint
  })

  test('allows recorded debt and rejects baseline growth and error edges', () => {
    const existing = violation('unclassified-module:existing')
    const added = violation('unclassified-module:added')
    const forbidden: Violation = {
      ...violation('forbidden-edge:alpha->beta:src/a.ts->src/b.ts#1'),
      kind: 'forbidden-edge',
      maturity: 'error'
    }
    expect(
      findRatchetFailures(
        [existing, added, forbidden],
        [existing.fingerprint, forbidden.fingerprint]
      )
    ).toEqual([added, forbidden])
  })

  test('requires exactly one owned exception per baseline violation', () => {
    const current = violation('unclassified-module:src/new.ts')
    expect(() => validateExceptionCoverage([current], [])).toThrow(
      'exactly one owned exception'
    )
    expect(() =>
      validateExceptionCoverage(
        [current],
        [
          exception({ exactFingerprints: [current.fingerprint] }),
          exception({
            id: 'DDD-EX-002',
            exactFingerprints: [current.fingerprint]
          })
        ]
      )
    ).toThrow('exactly one owned exception')
    expect(() =>
      validateExceptionCoverage(
        [current],
        [exception({ exactFingerprints: [current.fingerprint] })]
      )
    ).not.toThrow()
  })

  test('requires a named suppression to be owned by the exception it names', () => {
    const named: Violation = {
      ...violation(
        'named-suppression:DDD-EX-001:src/owned.ts:comfy/no-restricted-paths#1'
      ),
      exceptionId: 'DDD-EX-001',
      kind: 'named-suppression'
    }
    const wrongExistingId = exception({ id: 'DDD-EX-001' })
    const accidentalOwner = exception({
      id: 'DDD-EX-004',
      exactFingerprints: [named.fingerprint]
    })
    expect(() =>
      validateExceptionCoverage([named], [wrongExistingId, accidentalOwner])
    ).toThrow('names DDD-EX-001, but is owned by DDD-EX-004')

    const exactOwner = exception({
      id: 'DDD-EX-001',
      exactFingerprints: [named.fingerprint]
    })
    expect(() => validateExceptionCoverage([named], [exactOwner])).not.toThrow()
  })
})

describe('baseline admission and catalog stability', () => {
  test('acceptance requires exact ledger coverage for new debt', () => {
    const root = createConfiguredRepository()
    runArchitectureCheck(root, 'update')
    writeFileSync(
      join(root, 'src/new.ts'),
      '// eslint-disable-next-line comfy/no-restricted-paths\nexport const added = true'
    )
    expect(() => runArchitectureCheck(root, 'update')).toThrow(
      'must match exactly one owned exception'
    )
    expect(() => runArchitectureCheck(root, 'accept-baseline')).toThrow(
      'must match exactly one owned exception'
    )
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions.push(
      exception({
        exactFingerprints: [
          'anonymous-suppression:src/new.ts:comfy/no-restricted-paths#1'
        ]
      })
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
    ).toEqual(['anonymous-suppression:src/new.ts:comfy/no-restricted-paths#1'])
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

  test('report prints the census while the ledger is stale', () => {
    const root = createConfiguredRepository()
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions.push(
      exception({
        exactFingerprints: [
          'anonymous-suppression:src/resolved.ts:comfy/no-restricted-paths#1'
        ]
      })
    )
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runArchitectureCheck(root, 'report')
    expect(write).toHaveBeenCalledWith(expect.stringContaining('denominators'))
  })

  test('accept-baseline refuses error-maturity violations', () => {
    const root = createConfiguredRepository()
    const recordPath = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    record.modules = [
      { path: 'src/domains/images/index.ts', role: 'domain' },
      { path: 'src/domains/images/view.ts', role: 'presentation' }
    ]
    writeFileSync(recordPath, JSON.stringify(record))
    writeFileSync(
      join(root, 'src/domains/images/view.ts'),
      'export const view = 1'
    )
    writeFileSync(
      join(root, 'src/domains/images/index.ts'),
      "export { view } from './view'"
    )
    expect(() => runArchitectureCheck(root, 'accept-baseline')).toThrow(
      'cannot accept 1 error-maturity violation(s)'
    )
  })

  test('rejects a malformed baseline file', () => {
    const root = createConfiguredRepository()
    runArchitectureCheck(root, 'update')
    writeFileSync(
      join(root, 'docs/architecture/domains/baseline.json'),
      JSON.stringify({})
    )
    expect(() => runArchitectureCheck(root, 'check')).toThrow(
      'baseline.json must be { schemaVersion: 1, violations }'
    )
  })

  test('check and update reject stale exact debt ownership', () => {
    const root = createConfiguredRepository()
    runArchitectureCheck(root, 'update')
    const resolved =
      'anonymous-suppression:src/resolved.ts:comfy/no-restricted-paths#1'
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions.push(exception({ exactFingerprints: [resolved] }))
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    const baselinePath = join(root, 'docs/architecture/domains/baseline.json')
    writeFileSync(
      baselinePath,
      JSON.stringify({ schemaVersion: 1, violations: [resolved] })
    )
    expect(() => runArchitectureCheck(root, 'check')).toThrow(
      'exceptions.json has 1 stale exact fingerprint(s)'
    )
    expect(() => runArchitectureCheck(root, 'update')).toThrow(
      'exceptions.json has 1 stale exact fingerprint(s)'
    )
  })

  test('update keeps debt that is still present', () => {
    const root = createConfiguredRepository()
    const kept = 'anonymous-suppression:src/kept.ts:comfy/no-restricted-paths#1'
    const resolved =
      'anonymous-suppression:src/resolved.ts:comfy/no-restricted-paths#1'
    writeFileSync(
      join(root, 'src/kept.ts'),
      '// eslint-disable-next-line comfy/no-restricted-paths\nexport const kept = true'
    )
    const ledgerPath = join(root, 'docs/architecture/domains/exceptions.json')
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    ledger.exceptions.push(exception({ exactFingerprints: [kept] }))
    writeFileSync(ledgerPath, JSON.stringify(ledger))
    const baselinePath = join(root, 'docs/architecture/domains/baseline.json')
    writeFileSync(
      baselinePath,
      JSON.stringify({ schemaVersion: 1, violations: [kept, resolved] })
    )
    runArchitectureCheck(root, 'update')
    expect(JSON.parse(readFileSync(baselinePath, 'utf8')).violations).toEqual([
      kept
    ])
  })

  test('check rejects a manually baselined fingerprint without exact ownership', () => {
    const root = createConfiguredRepository()
    const recordPath = join(
      root,
      'docs/architecture/domains/records/images.domain.json'
    )
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    record.publicEntryPoints = []
    writeFileSync(recordPath, JSON.stringify(record))
    const fingerprint =
      'deep-import:images:src/consumer.ts->src/domains/images/index.ts#1'
    const baselinePath = join(root, 'docs/architecture/domains/baseline.json')
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
      'must match exactly one owned exception'
    )
  })
})
