import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

describe('owned layer utilities', () => {
  it.for([
    ['z-9999', 'class="z-9999"'],
    ['md:hover:-z-1000', ':class="{ \'md:hover:-z-1000\': open }"'],
    ['z-[9999]', ':class="cn(\'z-[9999]\')"'],
    ['z-(--escape)', ":class=\"open ? 'z-(--escape)' : 'z-overlay'\""],
    ['z-999!', 'class="z-999!"']
  ])(
    'rejects %s in Vue classes',
    { timeout: 15000 },
    async ([_className, attribute]) => {
      const [result] = await eslint.lintText(
        `<template><div ${attribute} /></template>`,
        { filePath: 'src/components/ui/lint-fixture/LintFixture.vue' }
      )
      expect(result.messages).toContainEqual(
        expect.objectContaining({
          ruleId: 'better-tailwindcss/no-restricted-classes',
          severity: 2
        })
      )
    }
  )

  it.for(["cn('z-1000')", "cva({ base: 'hover:z-[1000]' })"])(
    'rejects numeric layers in %s',
    async (expression) => {
      const [result] = await eslint.lintText(`const style = ${expression}`, {
        filePath: 'src/components/lint-fixture/lintFixture.ts'
      })
      expect(result.messages).toContainEqual(
        expect.objectContaining({
          ruleId: 'better-tailwindcss/no-restricted-classes',
          severity: 2
        })
      )
    }
  )

  it('allows named layers and small owner-local ordering', async () => {
    const [result] = await eslint.lintText(
      '<template><div class="z-overlay hover:z-toast md:z-toolbar z-10 -z-1" /></template>',
      { filePath: 'src/components/lint-fixture/LintFixture.vue' }
    )
    expect(
      result.messages.filter(
        ({ ruleId }) => ruleId === 'better-tailwindcss/no-restricted-classes'
      )
    ).toEqual([])
  })
})
