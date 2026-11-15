import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

async function restrictedClassMessages(classes: string) {
  const [result] = await eslint.lintText(
    `<template><div class="${classes}" /></template>`,
    { filePath: 'src/components/lint-fixture/LintFixture.vue' }
  )
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
    'md:group-has-[.subbutton:hover]:flex',
    'group-[:has(.subbutton)]:flex',
    'group-[&[data-state=open]:has(button)]:flex',
    'not-in-has-checked:flex',
    'not-in-[.group:has(.subbutton)]:flex',
    'not-in-[[data-state=open]:has(button)]:flex',
    'has-[>button]:*:pl-2',
    'has-checked:**:pl-2'
  ])('rejects %s', { timeout: 15000 }, async (className) => {
    expect(await restrictedClassMessages(className)).toContainEqual(
      expect.objectContaining({ severity: 2 })
    )
  })

  it('allows :has() forms that match without a nested descendant', async () => {
    expect(
      await restrictedClassMessages(
        'has-checked:flex not-has-checked:flex in-has-checked:flex peer-has-checked:flex [.group:has(:focus-visible)_&]:opacity-100 [&:has(>button)>input]:pl-2'
      )
    ).toEqual([])
  })
})
