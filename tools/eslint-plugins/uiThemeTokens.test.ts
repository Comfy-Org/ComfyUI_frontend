// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const uiComponentPath = 'src/components/ui/lint-fixture/LintFixture.vue'

async function themeTokenMessages(code: string, filePath = uiComponentPath) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter(
    ({ ruleId }) => ruleId === 'better-tailwindcss/no-restricted-classes'
  )
}

describe('UI theme token restrictions', () => {
  it.for([
    'bg-component-node-widget-background',
    'hover:bg-modal-card-background-hovered',
    'data-[state=active]:bg-interface-menu-component-surface-hovered',
    'data-[state=active]:text-text-primary',
    'data-[state=inactive]:hover:bg-button-hover-surface'
  ])(
    'rejects the specialized token in %s',
    { timeout: 15_000 },
    async (className) => {
      const messages = await themeTokenMessages(
        `<template><div class="${className}" /></template>`
      )

      expect(messages).toEqual([
        expect.objectContaining({
          ruleId: 'better-tailwindcss/no-restricted-classes',
          severity: 2
        })
      ])
    }
  )

  it('allows core semantic tokens', async () => {
    const messages = await themeTokenMessages(
      '<template><div class="bg-secondary-background text-base-foreground border-border-default" /></template>'
    )

    expect(messages).toEqual([])
  })

  it('does not constrain feature components outside the generic UI library', async () => {
    const messages = await themeTokenMessages(
      '<template><div class="bg-component-node-widget-background" /></template>',
      'src/components/lint-fixture/LintFixture.vue'
    )

    expect(messages).toEqual([])
  })
})
