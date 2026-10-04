import { describe, expect, it } from 'vitest'

import { inspectSource } from './expected-failure-ratchet'

describe('expected failure inventory', () => {
  it('finds Vitest and Playwright pins without matching inert text', () => {
    const source = `
      // it.fails('commented out', () => {})
      const explanation = "test.fail() is mentioned"
      it.fails('known unit defect', () => {})
      test('conditional browser defect', () => {
        test.fail(!available)
      })
      test.fail(true, 'declaration-level defect')
    `

    expect(inspectSource(source, 'example.test.ts')).toEqual([
      expect.objectContaining({
        id: 'vitest:example.test.ts:known unit defect:1',
        kind: 'vitest',
        title: 'known unit defect'
      }),
      expect.objectContaining({
        id: 'playwright:example.test.ts:conditional browser defect:1',
        kind: 'playwright',
        title: 'conditional browser defect'
      }),
      expect.objectContaining({
        id: 'playwright:example.test.ts:<declaration-level>:1',
        kind: 'playwright',
        title: '<declaration-level>'
      })
    ])
  })
})
