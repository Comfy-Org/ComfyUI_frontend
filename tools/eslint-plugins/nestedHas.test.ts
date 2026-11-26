import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

async function restrictedClassMessages(
  classes: string,
  filePath = 'src/components/lint-fixture/LintFixture.vue'
) {
  const source = filePath.endsWith('.vue')
    ? `<template><div class="${classes}" /></template>`
    : `export const style = cva({ base: '${classes}' })`
  const [result] = await eslint.lintText(source, { filePath })
  return result.messages.filter(
    ({ ruleId }) => ruleId === 'better-tailwindcss/no-restricted-classes'
  )
}

describe('nested :has() utilities', () => {
  it.for([
    'group-has-focus-visible:opacity-100',
    'group-has-focus-visible/grid:opacity-100',
    'not-group-has-focus-visible:opacity-100',
    'group-not-has-checked:flex',
    'group-not-not-has-checked:flex',
    'group-in-has-checked:flex',
    'group-peer-has-checked:flex',
    'md:group-has-[.subbutton:hover]:flex',
    'group-[:has(.subbutton)]:flex',
    'group-[&[data-state=open]:has(button)]:flex',
    'group-not-[&:has(button)]:flex',
    'not-in-has-checked:flex',
    'not-in-in-has-checked:flex',
    'in-not-in-has-checked:flex',
    'not-in-[.group:has(.subbutton)]:flex',
    'not-in-[[data-state=open]:has(button)]:flex',
    'not-in-not-[&:has(button)]:flex',
    'has-[>button]:*:pl-2',
    'has-checked:**:pl-2'
  ])('rejects %s', { timeout: 15000 }, async (className) => {
    expect(await restrictedClassMessages(className)).toContainEqual(
      expect.objectContaining({ severity: 2 })
    )
  })

  it.for([
    'packages/design-system/src/components/input-group/lintFixture.ts',
    'packages/layer-editor-ui/src/LintFixture.vue',
    'packages/mask-editor/src/ui/LintFixture.vue',
    'packages/account-ui/src/billing/LintFixture.vue',
    'apps/billing-web/src/LintFixture.vue'
  ])('rejects the nested form in %s', { timeout: 15000 }, async (filePath) => {
    expect(
      await restrictedClassMessages(
        'group-has-focus-visible:opacity-100',
        filePath
      )
    ).toContainEqual(expect.objectContaining({ severity: 2 }))
  })

  it('allows :has() forms that match without a nested descendant', async () => {
    expect(
      await restrictedClassMessages(
        'has-checked:flex not-has-checked:flex in-has-checked:flex peer-has-checked:flex [.group:has(:focus-visible)_&]:opacity-100 [&:has(>button)>input]:pl-2 group-[&.open]:[&:has(>button)]:flex not-in-[.open]:[&:has(>button)]:flex'
      )
    ).toEqual([])
  })
})
