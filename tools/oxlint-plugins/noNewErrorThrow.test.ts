import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { RuleTester } from 'oxlint/plugins-dev'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { noNewErrorThrow } from './noNewErrorThrow'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: {
    globals: { Error: 'readonly' },
    parserOptions: { lang: 'ts' }
  }
}).run('no-new-error-throw', noNewErrorThrow, {
  valid: [
    {
      name: 'returning errors as data',
      code: `
function parse(raw: string) {
  try { return { ok: true, value: JSON.parse(raw) } }
  catch (cause) { return { ok: false, cause } }
}
function refuse() { return new TypeError('invalid') }
`
    }
  ],
  invalid: [
    `throw new Error('new')`,
    `throw new TypeError('typed')`,
    `throw new RangeError('range')`,
    `throw new AggregateError([], 'aggregate')`,
    `class DomainError extends Error {}; throw new DomainError('domain')`,
    `const ErrorAlias = Error; throw new ErrorAlias('alias')`,
    `throw new globalThis.Error('qualified')`,
    `throw new errors.DomainError('qualified custom')`,
    `throw Error('without new')`,
    `throw makeError()`,
    `const error = new Error('stored'); throw error`,
    `try {} catch (error) { throw error }`,
    `{ class Error {}; throw new Error('shadowed') }`,
    `throw 'not an Error'`,
    `throw { message: 'not an Error' }`,
    `throw undefined`,
    `function useApp() {
  if (!instance) throw new TypeError('ComfyApp accessed before registerApp')
  return instance
}`,
    `function useExtensionDialogService() {
  if (!extensionDialogService) {
    throw new TypeError('Extension dialog service accessed before registerExtensionDialogService')
  }
  return extensionDialogService
}`
  ].map((code) => ({ code, errors: [{ messageId: 'forbidden' }] }))
})

it('enforces production throws while preserving file-scope exclusions', () => {
  const root = mkdtempSync(path.resolve('src/__throw_lint_'))
  const productionFiles = ['production.ts', 'production.tsx', 'Production.vue']
  const excludedFiles = [
    'types.d.ts',
    'unit.test.ts',
    'unit.test.tsx',
    'browser.spec.ts',
    'Component.stories.ts',
    'Component.stories.vue',
    ...[
      'test',
      'tests',
      '__test__',
      '__tests__',
      '__fixtures__',
      'fixtures',
      'generated',
      'vendor'
    ].map((directory) => `${directory}/example.ts`)
  ]
  try {
    for (const file of [...productionFiles, ...excludedFiles]) {
      const filename = path.join(root, file)
      mkdirSync(path.dirname(filename), { recursive: true })
      const code = `throw new TypeError('refused')`
      writeFileSync(
        filename,
        file.endsWith('.vue')
          ? `<script setup lang="ts">${code}</script>`
          : code
      )
    }
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/oxlint/bin/oxlint'),
        '--format=json',
        '--config',
        path.resolve('.oxlintrc.json'),
        root
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    const { diagnostics } = z
      .object({
        diagnostics: z.array(
          z.object({ code: z.string().optional(), filename: z.string() })
        )
      })
      .parse(JSON.parse(result.stdout))
    expect(
      diagnostics
        .filter(({ code }) => code === 'comfy(no-new-error-throw)')
        .map(({ filename }) => path.basename(filename))
        .sort()
    ).toEqual([...productionFiles].sort())
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
