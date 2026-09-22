// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const runtimeFilePath = 'src/config/subscriptionPricesConfig.ts'
const testFilePath = 'src/types/linkId.test.ts'
const restrictionMessage =
  'ES2023 array method is not polyfilled for build target es2022; use the matching ES2022-safe non-mutating equivalent.'

describe('ES2023 array method restrictions', () => {
  it.for([
    ['toReversed', 'items.toReversed()'],
    ['toSorted', 'items.toSorted()'],
    ['toSpliced', 'items.toSpliced(0, 1)'],
    ['with', 'items.with(0, 1)']
  ] as const)(
    'rejects %s calls in runtime files',
    async ([_name, code]) => {
      const [result] = await eslint.lintText(
        `const items = [1, 2]\n${code}`,
        {
          filePath: runtimeFilePath
        }
      )

      expect(result.messages).toEqual([
        expect.objectContaining({
          ruleId: 'es2022-compat/no-array-copy-method',
          severity: 2,
          message: restrictionMessage
        })
      ])
    },
    120_000
  )

  it.for([
    ['dotted', 'items.toSorted()'],
    ['computed literal', "items['toSorted']()"],
    ['computed template literal', 'items[`toSorted`]()']
  ] as const)('rejects %s calls in runtime files', async ([_name, code]) => {
    const [result] = await eslint.lintText(`const items = [1, 2]\n${code}`, {
      filePath: runtimeFilePath
    })

    expect(result.messages).toEqual([
      expect.objectContaining({
        ruleId: 'es2022-compat/no-array-copy-method',
        severity: 2,
        message: restrictionMessage
      })
    ])
  })

  it('composes the type-aware with check with computed syntax', async () => {
    const [result] = await eslint.lintText(
      `const items = [1, 2]
items['with'](0, 1)`,
      { filePath: runtimeFilePath }
    )

    expect(result.messages).toEqual([
      expect.objectContaining({
        ruleId: 'es2022-compat/no-array-copy-method',
        severity: 2,
        message: restrictionMessage
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
      { filePath: testFilePath }
    )

    expect(result.messages).toEqual([])
  })

  it('allows unrelated APIs with restricted method names', async () => {
    const [result] = await eslint.lintText(
      `const builder = {
  toSorted: () => 'sorted',
  with: (value: number) => value
}
builder.toSorted()
builder.with(3)`,
      { filePath: runtimeFilePath }
    )

    expect(result.messages).toEqual([])
  })

  it('allows computed identifiers that resolve to unrelated methods', async () => {
    const [result] = await eslint.lintText(
      `const items = [1, 2]
const toSorted = 'map' as const
items[toSorted]((item) => item * 2)`,
      { filePath: runtimeFilePath }
    )

    expect(result.messages).toEqual([])
  })

  it.for([
    [
      'constrained generic',
      `function replaceFirst<T extends number[]>(items: T) {
  return items.with(0, 1)
}`
    ],
    [
      'intersection',
      `declare const items: number[] & { tag: string }
items.with(0, 1)`
    ],
    [
      'optional union',
      `declare const items: number[] | undefined
items?.with(0, 1)`
    ]
  ] as const)('rejects Array.with on a %s receiver', async ([_name, code]) => {
    const [result] = await eslint.lintText(code, {
      filePath: runtimeFilePath
    })

    expect(result.messages).toEqual([
      expect.objectContaining({
        ruleId: 'es2022-compat/no-array-copy-method',
        severity: 2,
        message: restrictionMessage
      })
    ])
  })
})
