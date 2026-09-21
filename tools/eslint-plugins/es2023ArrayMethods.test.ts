// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const runtimeFilePath = 'src/es2023-array-method-coverage.ts'

describe('ES2023 array method restrictions', () => {
  it.each([
    ['toReversed dotted', 'items.toReversed()'],
    ['toReversed computed', "items['toReversed']()"],
    ['toSorted dotted', 'items.toSorted()'],
    ['toSorted computed', "items['toSorted']()"],
    ['toSpliced dotted', 'items.toSpliced(0, 1)'],
    ['toSpliced computed', "items['toSpliced'](0, 1)"],
    ['with dotted', 'items.with(0, 1)'],
    ['with computed', "items['with'](0, 1)"]
  ])('rejects %s calls in runtime files', async (_name, code) => {
    const [result] = await eslint.lintText(`const items = [1, 2]\n${code}`, {
      filePath: runtimeFilePath
    })

    expect(result.messages).toEqual([
      expect.objectContaining({
        ruleId: 'no-restricted-syntax',
        severity: 2
      })
    ])
  })

  it('allows the restricted methods in test files', async () => {
    const [result] = await eslint.lintText(
      `const items = [1, 2]
items.toReversed()
items['toSorted']()
items.toSpliced(0, 1)
items['with'](0, 1)`,
      { filePath: 'src/es2023-array-method-coverage.test.ts' }
    )

    expect(result.messages).toEqual([])
  })
})
