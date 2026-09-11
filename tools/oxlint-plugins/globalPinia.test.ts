import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RuleTester } from 'oxlint/plugins-dev'
import { afterAll, describe, expect, it } from 'vitest'

import { useGlobalPinia } from './globalPinia'

RuleTester.describe = describe
RuleTester.it = it

const directory = mkdtempSync(path.join(tmpdir(), 'comfy-global-pinia-'))
mkdirSync(path.join(directory, 'src'))
writeFileSync(
  path.join(directory, 'src/store.ts'),
  `import { defineStore as define } from 'pinia'
export const useExampleStore = define('example', () => ({}))
export function helper() {}`
)
writeFileSync(
  path.join(directory, 'src/namespaceStore.ts'),
  `import * as pinia from 'pinia'
export const useOtherStore = pinia.defineStore('other', () => ({}))`
)
writeFileSync(
  path.join(directory, 'src/barrel.ts'),
  `export { useExampleStore } from './store'`
)
writeFileSync(
  path.join(directory, 'src/layoutStore.ts'),
  `export const layoutStore = new Map()`
)
writeFileSync(
  path.join(directory, 'src/notStore.ts'),
  `const example = "defineStore('example', () => ({}))"`
)
writeFileSync(
  path.join(directory, 'src/types.ts'),
  `export type { Store } from 'pinia'`
)
writeFileSync(
  path.join(directory, 'src/inlineTypes.ts'),
  `export { type Store } from 'pinia'
export function formatName() { return 'name' }`
)
writeFileSync(
  path.join(directory, 'src/mixedExports.ts'),
  `export { type Store, defineStore } from 'pinia'`
)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
})
const filename = path.join(directory, 'src/example.test.ts')
const invalid = (code: string, message: RegExp) => ({
  code,
  filename,
  errors: [{ message }]
})

ruleTester.run('use-global-pinia', useGlobalPinia, {
  valid: [
    `import { getActivePinia, defineStore } from 'pinia'
const store = defineStore('fixture', () => ({}))(getActivePinia())`,
    {
      filename,
      code: `import { useExampleStore } from './store'
vi.mocked(useExampleStore().save).mockResolvedValue()`
    },
    {
      filename,
      code: `vi.mock(import('./layoutStore'), () => ({}))`
    },
    {
      filename,
      code: `vi.mock('./notStore', () => ({}))`
    },
    {
      filename,
      code: `vi.mock('./types', () => ({}))`
    },
    {
      filename,
      code: `vi.mock('./inlineTypes', () => ({ formatName: () => 'mock' }))`
    },
    {
      filename,
      code: `function local(vi) { vi.mock('./store') }`
    },
    {
      filename,
      code: `import * as stores from './store'
vi.spyOn(stores, 'helper')`
    },
    `const pinia = { createPinia() {} }; pinia.createPinia()`,
    `const example = "vi.mock('pinia')"`
  ],
  invalid: [
    invalid(`import { createPinia } from 'pinia'`, /global testing Pinia/),
    invalid(
      `import { createTestingPinia as create } from '@pinia/testing'`,
      /global testing Pinia/
    ),
    invalid(
      `import * as pinia from 'pinia'; pinia['createPinia']()`,
      /global testing Pinia/
    ),
    invalid(
      `const { createTestingPinia } = await import('@pinia/testing')`,
      /global testing Pinia/
    ),
    invalid(`vi.mock('pinia')`, /Do not mock Pinia/),
    invalid(`vi.doMock(import('@pinia/testing'))`, /Do not mock Pinia/),
    invalid(`vi.mock(import('./store'), () => ({}))`, /Do not mock Pinia/),
    invalid(
      `vi.mock(import('@/platform/settings/settingStore'))`,
      /Do not mock Pinia/
    ),
    invalid(`vi.doMock('./namespaceStore', () => ({}))`, /Do not mock Pinia/),
    invalid(`vi.mock('./barrel', () => ({}))`, /Do not mock Pinia/),
    invalid(`vi.mock('./mixedExports', () => ({}))`, /Do not mock Pinia/),
    invalid(
      `import { vi as testDouble } from 'vitest'
testDouble.mock('./store')`,
      /Do not mock Pinia/
    ),
    invalid(
      `import * as vitest from 'vitest'
vitest.vi.doMock(import('./store'))`,
      /Do not mock Pinia/
    ),
    invalid(
      `import { vitest } from 'vitest'
vitest.mock('pinia')`,
      /Do not mock Pinia/
    ),
    invalid(`vitest.mock('pinia')`, /Do not mock Pinia/),
    invalid(
      `import * as stores from './store'
vi.spyOn(stores, 'useExampleStore')`,
      /Do not mock Pinia/
    ),
    invalid(
      `import { useExampleStore as useStore } from './store'
vi.mocked(useStore).mockReturnValue({})`,
      /Do not mock Pinia/
    ),
    invalid(
      `import * as pinia from 'pinia'
vi.spyOn(pinia, 'defineStore')`,
      /Do not mock Pinia/
    )
  ]
})

it('enforces the rule through both repository lint configurations', () => {
  const code = `import { createPinia } from 'pinia'
createPinia()
vi.mock('pinia')`
  const testPath = path.join(directory, 'src/example.test.ts')
  const appPath = path.join(directory, 'src/example.ts')
  const ignoredTestPath = path.join(directory, 'src/scripts/ignored.test.ts')
  const helperPaths = [
    path.join(directory, 'src/__test__/testUtils.ts'),
    path.join(directory, 'src/__tests__/helpers.ts'),
    path.join(directory, 'src/__fixtures__/fixture.ts')
  ]
  for (const file of [testPath, appPath, ignoredTestPath, ...helperPaths]) {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, code)
  }

  for (const [config, files] of [
    ['.oxlintrc.json', [testPath, appPath, ...helperPaths]],
    [
      'tools/oxlint-plugins/vitestCleanup.config.json',
      [ignoredTestPath, appPath, ...helperPaths]
    ]
  ] as const) {
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/oxlint/bin/oxlint'),
        '--format=json',
        '--config',
        path.resolve(config),
        ...files
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stdout.match(/comfy\(use-global-pinia\)/g)).toHaveLength(8)
    expect(result.stdout).not.toContain('"filename": "src/example.ts"')
  }
})
