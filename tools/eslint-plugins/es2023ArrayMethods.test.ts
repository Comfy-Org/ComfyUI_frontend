// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const runtimeFilePath = 'src/config/subscriptionPricesConfig.ts'
const testFilePath = 'src/types/linkId.test.ts'
const restrictionMessage =
  'ES2023 array method is not polyfilled for build target es2022; use the matching ES2022-safe non-mutating equivalent.'

const restriction = expect.objectContaining({
  ruleId: 'es2022-compat/no-array-copy-method',
  severity: 2,
  message: restrictionMessage
})

describe('ES2023 array method restrictions', () => {
  it.for([
    ['toReversed', 'items.toReversed()'],
    ['toSorted', 'items.toSorted()'],
    ['toSpliced', 'items.toSpliced(0, 1)'],
    ['with', 'items.with(0, 1)'],
    ['computed literal', "items['toSorted']()"],
    ['computed template literal', 'items[`toSorted`]()'],
    ['optional chain', 'items?.with(0, 1)'],
    ['typed array', 'new Uint8Array(1).toSorted()']
  ] as const)('rejects %s calls in runtime files', async ([_name, code]) => {
    const [result] = await eslint.lintText(`const items = [1, 2]\n${code}`, {
      filePath: runtimeFilePath
    })

    expect(result.messages).toEqual([restriction])
  })

  it('allows the restricted methods in test files', async () => {
    const [result] = await eslint.lintText(
      `const items = [1, 2]
items.toReversed()
items['toSorted']()
items.toSpliced(0, 1)
items['with'](0, 1)`,
      { filePath: testFilePath }
    )

    expect(result.messages).toEqual([])
  })

  it.for([
    ['property access without a call', 'const fn = items.toSorted'],
    ['computed identifier', "const method = 'map' as const\nitems[method]()"],
    ['unrelated method name', 'items.sort()']
  ] as const)('allows %s', async ([_name, code]) => {
    const [result] = await eslint.lintText(`const items = [1, 2]\n${code}`, {
      filePath: runtimeFilePath
    })

    expect(result.messages).toEqual([])
  })
})
