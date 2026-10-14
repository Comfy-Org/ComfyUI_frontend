import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'

import { buildCatalog, parseCodeowners } from './catalog'
import { formatReport, main, runArchitecture } from './cli'
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
      error: 'Unrecognized key: "owners"'
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
    expect(loadArchitectureConfiguration(root)).toEqual({
      ok: false,
      errors: [expect.stringContaining(error)]
    })
  })

  it('collects every unreadable record and ledger instead of stopping at the first', () => {
    const root = createRepository(
      {},
      {
        'docs/architecture/domains/records/broken.domain.json': '{',
        'docs/architecture/domains/exceptions.json': '[]'
      }
    )
    expect(loadArchitectureConfiguration(root)).toEqual({
      ok: false,
      errors: [
        expect.stringContaining(
          'Could not parse docs/architecture/domains/records/broken.domain.json as JSON'
        ),
        expect.stringContaining(
          'docs/architecture/domains/exceptions.json is invalid'
        )
      ]
    })
  })
})

describe('runArchitecture', () => {
  it('passes after update writes the boundaries config', () => {
    const root = createRepository()
    expect(runArchitecture(root, 'update')).toEqual({
      errors: [],
      warnings: []
    })
    expect(runArchitecture(root, 'check')).toEqual({
      errors: [],
      warnings: []
    })
  })

  it('formats the written boundaries config with oxfmt', () => {
    const root = createRepository()
    runArchitecture(root, 'update')
    expect(
      readFileSync(
        join(root, 'docs/architecture/domains/boundaries.json'),
        'utf8'
      )
    ).toContain('"patterns": ["src/images/**"]')
  })

  it('warns about unclassified files and stale module paths without failing', () => {
    const root = createRepository(
      {
        modules: [...record.modules, { path: 'src/gone/**', role: 'domain' }]
      },
      { 'src/brandNew.ts': '' }
    )
    runArchitecture(root, 'update')
    expect(runArchitecture(root, 'check')).toEqual({
      errors: [],
      warnings: [
        {
          message: expect.stringContaining(
            'images path matches no source files: src/gone/**'
          ),
          file: 'docs/architecture/domains/records/images.domain.json'
        },
        {
          message: expect.stringContaining(
            'src/brandNew.ts is not claimed by any domain'
          ),
          file: 'src/brandNew.ts'
        }
      ]
    })
  })

  it('reports invalid records as errors instead of throwing', () => {
    const root = createRepository({ allowedDependencies: ['media'] })
    expect(runArchitecture(root, 'check')).toEqual({
      errors: ['images references unknown domain media'],
      warnings: []
    })
  })

  it('reports a boundaries config that no longer matches the records', () => {
    const root = createRepository()
    runArchitecture(root, 'update')
    writeFileSync(
      join(root, 'docs/architecture/domains/records/images.domain.json'),
      JSON.stringify({ ...record, deepImports: 'inventory' })
    )
    expect(runArchitecture(root, 'check').errors).toEqual([
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
    expect(runArchitecture(root, 'check').errors).toEqual([
      expect.stringContaining(
        'anonymous-suppression:src/legacy.ts:boundary-violation#1 is a new architecture suppression'
      )
    ])
  })
})

describe('main', () => {
  function runMain(args: string[], root: string) {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const exitCode = main(args, root)
    const output = stderr.mock.calls.map(([text]) => String(text)).join('')
    stderr.mockRestore()
    return { exitCode, output }
  }

  it.for([
    { name: 'no mode', args: [], error: 'Pass exactly one of' },
    {
      name: 'two modes',
      args: ['--check', '--update'],
      error: 'Pass exactly one of'
    },
    {
      name: 'an unknown option',
      args: ['--chek'],
      error: "Could not parse arguments: Unknown option '--chek'"
    }
  ])('reports $name as an error', ({ args, error }) => {
    const { exitCode, output } = runMain(args, createRepository())
    expect(exitCode).toBe(1)
    expect(output).toContain(error)
  })

  it('reports a repository without architecture files as errors', () => {
    const root = mkdtempSync(join(tmpdir(), 'comfyui-architecture-'))
    roots.push(root)
    const { exitCode, output } = runMain(['--check'], root)
    expect(exitCode).toBe(1)
    expect(output).toContain('Could not list docs/architecture/domains/records')
    expect(output).toContain('Could not list src')
  })
})

describe('formatReport', () => {
  const report = {
    errors: ['records/a.json is invalid:\n  id: 100% wrong'],
    warnings: [{ message: 'src/new.ts is unclaimed', file: 'src/new.ts' }]
  }

  it('lists warnings and errors as plain text', () => {
    expect(formatReport(report, false)).toBe(
      'Warnings (1):\n- src/new.ts is unclaimed\nErrors (1):\n- records/a.json is invalid:\n  id: 100% wrong\n'
    )
  })

  it('escapes commas and colons in an annotation file property', () => {
    expect(
      formatReport(
        {
          errors: [],
          warnings: [{ message: 'unclaimed', file: 'src/a,b:c%.ts' }]
        },
        true
      )
    ).toBe('::warning file=src/a%2Cb%3Ac%25.ts,title=Architecture::unclaimed\n')
  })

  it('emits one escaped GitHub Actions annotation per finding', () => {
    expect(formatReport(report, true)).toBe(
      '::warning file=src/new.ts,title=Architecture::src/new.ts is unclaimed\n' +
        '::error title=Architecture::records/a.json is invalid:%0A  id: 100%25 wrong\n'
    )
  })
})

function loadValidConfiguration(root: string) {
  const loaded = loadArchitectureConfiguration(root)
  assert(loaded.ok, loaded.ok ? '' : loaded.errors.join('\n'))
  return loaded.value
}

describe('buildCatalog', () => {
  it('reads module owners from CODEOWNERS', () => {
    const root = createRepository()
    const catalog = buildCatalog(
      loadValidConfiguration(root),
      parseCodeowners('/src/ @fallback\n/src/images/ @images-team\n')
    )
    expect(catalog.domains[0].modules).toEqual([
      { path: 'src/images/**', role: 'domain', owners: ['@images-team'] },
      { path: 'src/imageView.vue', role: 'presentation', owners: ['@fallback'] }
    ])
  })

  it('reports source coverage from directory and exact module paths', () => {
    const root = createRepository(
      {},
      {
        'src/zeta.tsx': '',
        'src/imageView.test.ts': '',
        'src/images/nested/deep.vue': '<template />',
        'src/README.md': '',
        'apps/desktop/main.ts': ''
      }
    )
    const catalog = buildCatalog(loadValidConfiguration(root), [])
    expect(catalog.domains[0].sourceFileCount).toBe(4)
    expect(catalog.coverage).toEqual({
      total: 6,
      classified: 4,
      unclassified: 2,
      unclassifiedFiles: ['src/imageView.test.ts', 'src/zeta.tsx']
    })
  })
})
