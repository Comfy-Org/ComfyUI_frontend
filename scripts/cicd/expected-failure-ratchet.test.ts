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
      test.fail.only('focused browser defect', () => {})
      fixture.fail(true, 'fixture teardown defect')
      it.skip.fails('skipped unit defect', () => {})
      it.fails.each([1])('parameterized unit defect', () => {})
    `

    expect(inspectSource(source, 'browser_tests/example.spec.ts')).toEqual([
      {
        id: 'vitest:browser_tests/example.spec.ts:known unit defect:1',
        kind: 'vitest',
        file: 'browser_tests/example.spec.ts',
        line: 4,
        title: 'known unit defect'
      },
      {
        id: 'playwright:browser_tests/example.spec.ts:conditional browser defect:1',
        kind: 'playwright',
        file: 'browser_tests/example.spec.ts',
        line: 6,
        title: 'conditional browser defect'
      },
      {
        id: 'playwright:browser_tests/example.spec.ts:<declaration-level>:1',
        kind: 'playwright',
        file: 'browser_tests/example.spec.ts',
        line: 8,
        title: '<declaration-level>'
      },
      {
        id: 'playwright:browser_tests/example.spec.ts:focused browser defect:1',
        kind: 'playwright',
        file: 'browser_tests/example.spec.ts',
        line: 9,
        title: 'focused browser defect'
      },
      {
        id: 'playwright:browser_tests/example.spec.ts:<declaration-level>:2',
        kind: 'playwright',
        file: 'browser_tests/example.spec.ts',
        line: 10,
        title: '<declaration-level>'
      },
      {
        id: 'vitest:browser_tests/example.spec.ts:skipped unit defect:1',
        kind: 'vitest',
        file: 'browser_tests/example.spec.ts',
        line: 11,
        title: 'skipped unit defect'
      },
      {
        id: 'vitest:browser_tests/example.spec.ts:parameterized unit defect:1',
        kind: 'vitest',
        file: 'browser_tests/example.spec.ts',
        line: 12,
        title: 'parameterized unit defect'
      }
    ])
  })
})
