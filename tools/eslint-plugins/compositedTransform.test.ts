import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const boundTransform =
  '<template><div :style="{ transform: `translate(${x}px, 0)` }" /></template>'

async function restrictedSyntaxMessages(filePath: string, template: string) {
  const [result] = await eslint.lintText(template, { filePath })
  return result.messages.filter(
    ({ ruleId }) => ruleId === 'vue/no-restricted-syntax'
  )
}

describe('composited transform bindings', () => {
  it.for([
    'src/components/graph/lint-fixture/LintFixture.vue',
    'src/renderer/extensions/lint-fixture/LintFixture.vue',
    'src/components/graph/SelectionToolbox.vue',
    'src/renderer/core/layout/transform/TransformPane.vue'
  ])(
    'rejects a bound transform in %s',
    { timeout: 15000 },
    async (filePath) => {
      expect(
        await restrictedSyntaxMessages(filePath, boundTransform)
      ).toContainEqual(
        expect.objectContaining({
          severity: 2,
          message: expect.stringContaining('useCompositedTransform')
        })
      )
    }
  )

  it.for([
    'open ? { transform } : undefined',
    "{ 'transform': position }",
    '{ translate: position }',
    '{ scale: zoom }',
    "{ 'rotate': angle }",
    "{ ['rotate']: angle }"
  ])('rejects the bound style %s', async (style) => {
    expect(
      await restrictedSyntaxMessages(
        'src/components/graph/lint-fixture/LintFixture.vue',
        `<template><div :style="${style}" /></template>`
      )
    ).toHaveLength(1)
  })

  it.for([
    [
      'src/components/graph/lint-fixture/LintFixture.vue',
      '<template><div :style="{ width: `${x}px` }" /></template>'
    ],
    [
      'src/components/graph/lint-fixture/LintFixture.vue',
      '<template><div :style="{ [scale]: width }" /></template>'
    ],
    [
      'src/components/graph/lint-fixture/LintFixture.vue',
      '<template><div :style="{ width: getWidth({ scale: zoom }) }" /></template>'
    ],
    ['src/components/sidebar/lint-fixture/LintFixture.vue', boundTransform],
    [
      'src/renderer/extensions/vueNodes/components/LGraphNode.vue',
      boundTransform
    ]
  ])('allows fixture %# in %s', async ([filePath, template]) => {
    expect(await restrictedSyntaxMessages(filePath, template)).toEqual([])
  })

  it('keeps the tooltip restrictions on graph canvas templates', async () => {
    expect(
      await restrictedSyntaxMessages(
        'src/components/graph/lint-fixture/LintFixture.vue',
        '<template><TooltipProvider><div v-tooltip="label" /></TooltipProvider></template>'
      )
    ).toHaveLength(2)
    expect(
      await restrictedSyntaxMessages(
        'src/components/graph/SelectionToolbox.vue',
        '<template><TooltipProvider><div v-tooltip="label" /></TooltipProvider></template>'
      )
    ).toHaveLength(1)
  })
})
