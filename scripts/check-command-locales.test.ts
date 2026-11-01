import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  checkCommandLocales,
  collectDeclaredCommands,
  findCommandLocaleGaps,
  formatGap
} from './check-command-locales'

const LOAD3D_FILE = 'src/extensions/core/load3d/load3d.ts'

/** The real lazy extension shape, reduced to what the guard reads. */
const LAZY_EXTENSION = `
export const load3dExtension: ComfyExtension = {
  name: 'Comfy.Load3D',
  commands: [
    {
      id: 'Comfy.3DViewer.Open3DViewer',
      label: 'Open 3D Viewer (Beta) for Selected Node',
      function: () => {}
    }
  ]
}
`

const VIEWER_ENTRY = {
  Comfy_3DViewer_Open3DViewer: {
    label: 'Open 3D Viewer (Beta) for Selected Node'
  }
}

describe('collectDeclaredCommands', () => {
  test('finds an id in a ComfyExtension commands array', () => {
    const { declared, unresolved } = collectDeclaredCommands(
      LOAD3D_FILE,
      LAZY_EXTENSION
    )
    expect(declared).toEqual([
      { id: 'Comfy.3DViewer.Open3DViewer', file: LOAD3D_FILE, line: 6 }
    ])
    expect(unresolved).toEqual([])
  })

  test('finds ids in a `const commands = [...]` list, as useCoreCommands declares them', () => {
    const fixture = `
      const commands = [
        { id: 'Comfy.Undo', label: 'Undo', function: () => {} },
        { id: 'Comfy.Redo', label: 'Redo', function: () => {} }
      ]
    `
    expect(
      collectDeclaredCommands('src/composables/useCoreCommands.ts', fixture)
        .declared
    ).toEqual([
      expect.objectContaining({ id: 'Comfy.Undo' }),
      expect.objectContaining({ id: 'Comfy.Redo' })
    ])
  })

  test('unwraps `as const` and `satisfies` around the array', () => {
    const asConst = `const commands = [{ id: 'Comfy.A' }] as const`
    const satisfied = `const commands = [{ id: 'Comfy.B' }] satisfies ComfyCommand[]`
    expect(collectDeclaredCommands('a.ts', asConst).declared).toEqual([
      expect.objectContaining({ id: 'Comfy.A' })
    ])
    expect(collectDeclaredCommands('b.ts', satisfied).declared).toEqual([
      expect.objectContaining({ id: 'Comfy.B' })
    ])
  })

  test('ignores a menuCommands entry, which references ids instead of declaring them', () => {
    const fixture = `
      const menuCommands = [
        { path: ['Extensions'], commands: ['Comfy-Desktop.OpenDevTools'] }
      ]
    `
    expect(collectDeclaredCommands('src/x.ts', fixture).declared).toEqual([])
  })

  test('reports a computed id as unresolved rather than silently dropping it', () => {
    const fixture = `const commands = [{ id: \`Comfy.\${suffix}\`, function: run }]`
    const { declared, unresolved } = collectDeclaredCommands(
      'src/x.ts',
      fixture
    )
    expect(declared).toEqual([])
    expect(unresolved).toEqual([{ file: 'src/x.ts', line: 1 }])
  })
})

describe('findCommandLocaleGaps', () => {
  const declared = [
    { id: 'Comfy.3DViewer.Open3DViewer', file: LOAD3D_FILE, line: 60 }
  ]

  test('reports the id the locale regeneration pruned', () => {
    expect(
      findCommandLocaleGaps(declared, { Comfy_Undo: { label: 'Undo' } })
    ).toEqual([
      {
        id: 'Comfy.3DViewer.Open3DViewer',
        key: 'Comfy_3DViewer_Open3DViewer',
        file: LOAD3D_FILE,
        line: 60,
        reason: 'missing-entry'
      }
    ])
  })

  test('passes once the entry is restored', () => {
    expect(findCommandLocaleGaps(declared, VIEWER_ENTRY)).toEqual([])
  })

  test('rejects an entry whose label is absent or blank, which call sites read', () => {
    const reasons = [
      { Comfy_3DViewer_Open3DViewer: {} },
      { Comfy_3DViewer_Open3DViewer: { label: '   ' } },
      { Comfy_3DViewer_Open3DViewer: { tooltip: 'Open it' } }
    ].map((catalog) => findCommandLocaleGaps(declared, catalog)[0]?.reason)
    expect(reasons).toEqual(['missing-label', 'missing-label', 'missing-label'])
  })

  test('reports a duplicated declaration once', () => {
    const twice = [...declared, { ...declared[0], file: 'src/other.ts' }]
    expect(findCommandLocaleGaps(twice, {})).toHaveLength(1)
  })

  test('names the declaration site and the missing key', () => {
    expect(formatGap(findCommandLocaleGaps(declared, {})[0])).toBe(
      `${LOAD3D_FILE}:60 command 'Comfy.3DViewer.Open3DViewer' has no commands.Comfy_3DViewer_Open3DViewer entry`
    )
  })
})

describe('checkCommandLocales over a repository tree', () => {
  let root: string

  function write(file: string, contents: string): void {
    const target = join(root, file)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, contents)
  }

  function writeCatalog(catalog: object): void {
    write('src/locales/en/commands.json', JSON.stringify(catalog, null, 2))
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'command-locales-'))
    write(LOAD3D_FILE, LAZY_EXTENSION)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  test('fails the pruned release state', () => {
    writeCatalog({ Comfy_Undo: { label: 'Undo' } })
    expect(checkCommandLocales(root).gaps).toEqual([
      expect.objectContaining({
        id: 'Comfy.3DViewer.Open3DViewer',
        reason: 'missing-entry'
      })
    ])
  })

  test('passes the repaired state', () => {
    writeCatalog(VIEWER_ENTRY)
    const { gaps, declared } = checkCommandLocales(root)
    expect(gaps).toEqual([])
    expect(declared).toHaveLength(1)
  })

  test('skips test files, so a fixture command needs no locale entry', () => {
    write(
      'src/extensions/core/load3d/load3dLazy.test.ts',
      `const extension = { commands: [{ id: 'test.lazy3d.command' }] }`
    )
    write(
      'src/platform/extensions/__tests__/helpers.ts',
      `const commands = [{ id: 'test.helper.command' }]`
    )
    writeCatalog(VIEWER_ENTRY)
    expect(checkCommandLocales(root).gaps).toEqual([])
  })
})
