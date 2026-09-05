import { ESLint } from 'eslint'
import path from 'node:path'
import { expect, it } from 'vitest'

it(
  'keeps the remote Zod restriction effective and cross-referenced',
  { timeout: 30_000 },
  async () => {
    const eslint = new ESLint({
      cwd: path.resolve('.')
    })
    const config = await eslint.calculateConfigForFile(
      'src/platform/remote/probe.ts'
    )
    const restriction = config.rules?.['no-restricted-syntax'] as unknown[]

    expect(restriction?.[0]).toBe(2)
    expect(restriction).toContainEqual(
      expect.objectContaining({
        selector: "ImportDeclaration[source.value='zod']",
        message: expect.stringContaining('comfy/no-duplicate-ingest-type')
      })
    )
  }
)
