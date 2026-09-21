// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const runtimeFilePath = 'src/config/subscriptionPricesConfig.ts'
const testFilePath = 'src/types/linkId.test.ts'

describe('ES2023 array method restrictions', () => {
  it.for([
    ['toReversed dotted', 'items.toReversed()', 'no-restricted-syntax'],
    ['toReversed computed', "items['toReversed']()", 'no-restricted-syntax'],
    ['toSorted dotted', 'items.toSorted()', 'no-restricted-syntax'],
    ['toSorted computed', "items['toSorted']()", 'no-restricted-syntax'],
    ['toSpliced dotted', 'items.toSpliced(0, 1)', 'no-restricted-syntax'],
    ['toSpliced computed', "items['toSpliced'](0, 1)", 'no-restricted-syntax'],
    ['with dotted', 'items.with(0, 1)', 'es2022-compat/no-array-with'],
    ['with computed', "items['with'](0, 1)", 'es2022-compat/no-array-with']
  ] as const)(
    'rejects %s calls in runtime files',
    async ([_name, code, expectedRuleId]) => {
      const [result] = await eslint.lintText(`const items = [1, 2]\n${code}`, {
        filePath: runtimeFilePath
      })

      expect(result.messages).toEqual([
        expect.objectContaining({
          ruleId: expectedRuleId,
          severity: 2
        })
      ])
    }
  )

  it.for([
    ['toReversed', 'items[`toReversed`]()', 'no-restricted-syntax'],
    ['toSorted', 'items[`toSorted`]()', 'no-restricted-syntax'],
    ['toSpliced', 'items[`toSpliced`](0, 1)', 'no-restricted-syntax'],
    ['with', 'items[`with`](0, 1)', 'es2022-compat/no-array-with']
  ] as const)(
    'rejects template-literal %s calls in runtime files',
    async ([_name, code, expectedRuleId]) => {
      const [result] = await eslint.lintText(`const items = [1, 2]\n${code}`, {
        filePath: runtimeFilePath
      })

      expect(result.messages).toEqual([
        expect.objectContaining({
          ruleId: expectedRuleId,
          severity: 2
        })
      ])
    }
  )

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

  it('allows unrelated APIs named with in runtime files', async () => {
    const [result] = await eslint.lintText(
      `const builder = { with: (value: number) => value }
builder.with(3)`,
      { filePath: runtimeFilePath }
    )

    expect(result.messages).toEqual([])
  })
})
