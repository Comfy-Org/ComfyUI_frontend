import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildCatalog, parseCodeowners } from './catalog'
import { runArchitecture } from './cli'
import { loadArchitectureConfiguration } from './records'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true })
})

const record = {
  id: 'images',
  capability: 'Images',
  description: 'Image fixture',
  modules: [
    { path: 'src/images/**', role: 'domain' },
    { path: 'src/imageView.vue', role: 'presentation' }
  ],
  publicEntryPoints: ['src/images/index.ts'],
  allowedDependencies: [],
  allowedConsumers: [],
  characterizationScenarios: [
    { name: 'keeps its contract', checks: ['src/images/index.test.ts'] }
  ],
  adrs: [],
  compatibilityPromises: ['keeps its contract'],
  deepImports: 'enforced'
}

function createRepository(
  overrides: Record<string, unknown> = {},
  files: Record<string, string> = {}
): string {
  const root = mkdtempSync(join(tmpdir(), 'comfyui-architecture-'))
  roots.push(root)
  const contents: Record<string, string> = {
    CODEOWNERS: '/src/images/ @images-team\n/src/imageView.vue @ui-team\n',
    'src/images/index.ts': 'export const value = 1',
    'src/images/index.test.ts': 'export const check = true',
    'src/imageView.vue': '<template />',
    'docs/architecture/domains/records/images.domain.json': JSON.stringify({
      ...record,
      ...overrides
    }),
    'docs/architecture/domains/exceptions.json': JSON.stringify({
      exceptions: []
    }),
    ...files
  }
  for (const [filename, text] of Object.entries(contents)) {
    mkdirSync(dirname(join(root, filename)), { recursive: true })
    writeFileSync(join(root, filename), text)
  }
  return root
}

describe('loadArchitectureConfiguration', () => {
  it.for([
    {
      name: 'an unknown record field',
      overrides: { owners: ['@images-team'] },
      error: "Unrecognized key(s) in object: 'owners'"
    },
    {
      name: 'a glob other than a trailing /**',
      overrides: { modules: [{ path: 'src/images/*.ts', role: 'domain' }] },
      error: 'must be a src/ file or a src/ directory ending in /**'
    },
    {
      name: 'an unknown domain reference',
      overrides: { allowedDependencies: ['media'] },
      error: 'images references unknown domain media'
    },
    {
      name: 'a module path without files',
      overrides: {
        modules: [...record.modules, { path: 'src/gone/**', role: 'domain' }]
      },
      error: 'images path matches no source files: src/gone/**'
    },
    {
      name: 'overlapping module paths',
      overrides: {
        modules: [
          ...record.modules,
          { path: 'src/images/index.ts', role: 'application' }
        ]
      },
      error: 'src/images/index.ts is claimed by more than one module'
    },
    {
      name: 'a missing characterization check',
      overrides: {
        characterizationScenarios: [{ name: 'x', checks: ['src/gone.test.ts'] }]
      },
      error: 'images references missing file src/gone.test.ts'
    },
    {
      name: 'a public entry point outside the domain',
      overrides: { publicEntryPoints: ['src/other.ts'] },
      error: 'public entry point is outside its modules'
    }
  ])('rejects $name', ({ overrides, error }) => {
    const root = createRepository(overrides, { 'src/other.ts': '' })
    expect(() => loadArchitectureConfiguration(root)).toThrow(error)
  })
})

describe('runArchitecture', () => {
  it('passes after update writes the boundaries config', () => {
    const root = createRepository()
    expect(runArchitecture(root, 'update')).toEqual([])
    expect(runArchitecture(root, 'check')).toEqual([])
  })

  it('reports a boundaries config that no longer matches the records', () => {
    const root = createRepository()
    runArchitecture(root, 'update')
    writeFileSync(
      join(root, 'docs/architecture/domains/records/images.domain.json'),
      JSON.stringify({ ...record, deepImports: 'inventory' })
    )
    expect(runArchitecture(root, 'check')).toEqual([
      'docs/architecture/domains/boundaries.json is out of date; run pnpm architecture:update'
    ])
  })

  it('reports a suppression missing from the ledger', () => {
    const root = createRepository(
      {},
      {
        'src/legacy.ts':
          '// fallow-ignore-next-line boundary-violation\nimport "./images/internal"'
      }
    )
    runArchitecture(root, 'update')
    expect(runArchitecture(root, 'check')).toEqual([
      expect.stringContaining(
        'anonymous-suppression:src/legacy.ts:boundary-violation#1 is a new architecture suppression'
      )
    ])
  })
})

describe('buildCatalog', () => {
  it('reads module owners from CODEOWNERS', () => {
    const root = createRepository()
    const catalog = buildCatalog(
      loadArchitectureConfiguration(root),
      parseCodeowners('/src/ @fallback\n/src/images/ @images-team\n')
    )
    expect(catalog.domains[0].modules).toEqual([
      { path: 'src/images/**', role: 'domain', owners: ['@images-team'] },
      { path: 'src/imageView.vue', role: 'presentation', owners: ['@fallback'] }
    ])
  })
})
