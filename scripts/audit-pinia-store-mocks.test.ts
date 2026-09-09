import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

it('finds string, import-form, and helper mocks while excluding non-Pinia modules', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pinia-mock-audit-'))
  try {
    mkdirSync(join(directory, 'src'))
    writeFileSync(
      join(directory, 'src/store.ts'),
      "export const useStore = defineStore('example', () => ({}))"
    )
    writeFileSync(
      join(directory, 'src/layoutStore.ts'),
      'export const layoutStore = new Map()'
    )
    writeFileSync(
      join(directory, 'src/example.test.ts'),
      [
        "vi.mock('@/store', () => ({}))",
        'vi.mock<unknown>(',
        "  import('./store'),",
        '  () => ({})',
        ')',
        "vi.mock(import('./layoutStore'), () => ({}))",
        'vi.mocked(useStore().action).mockReturnValue(1)',
        'const example = "vi.mock(\'@/store\')"'
      ].join('\n')
    )
    writeFileSync(
      join(directory, 'src/testHelper.ts'),
      "vi.doMock(import('./store'), () => ({}))"
    )
    execFileSync('git', ['init', '--quiet'], { cwd: directory })
    execFileSync(
      'git',
      ['add', 'src/example.test.ts', 'src/store.ts', 'src/layoutStore.ts'],
      { cwd: directory }
    )

    const output = execFileSync(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        join(import.meta.dirname, 'audit-pinia-store-mocks.ts')
      ],
      { cwd: directory, encoding: 'utf8' }
    )

    expect(output.trim().split('\n')).toEqual([
      'src/example.test.ts:1\t@/store',
      'src/example.test.ts:2\t./store',
      'src/testHelper.ts:1\t./store',
      '3 store-module mock candidates in 2 files'
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
