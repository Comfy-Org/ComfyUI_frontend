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
      const fixture = test.extend({})
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
        line: 11,
        title: '<declaration-level>'
      },
      {
        id: 'vitest:browser_tests/example.spec.ts:skipped unit defect:1',
        kind: 'vitest',
        file: 'browser_tests/example.spec.ts',
        line: 12,
        title: 'skipped unit defect'
      },
      {
        id: 'vitest:browser_tests/example.spec.ts:parameterized unit defect:1',
        kind: 'vitest',
        file: 'browser_tests/example.spec.ts',
        line: 13,
        title: 'parameterized unit defect'
      }
    ])
  })

  it('uses extended fixture declaration titles in inventory IDs', () => {
    const inventoryId = (title: string) =>
      inspectSource(
        `
          import { baseFixture } from '@e2e/fixtures/baseFixture'
          const fixture = baseFixture.extend({})
          fixture('${title}', () => fixture.fail(true))
        `,
        'browser_tests/fixture.spec.ts'
      )[0].id

    expect(inventoryId('old title')).toBe(
      'playwright:browser_tests/fixture.spec.ts:old title:1'
    )
    expect(inventoryId('new title')).toBe(
      'playwright:browser_tests/fixture.spec.ts:new title:1'
    )
  })

  it('uses computed test titles instead of positional declaration IDs', () => {
    const source = `
      for (const scenario of scenarios) {
        test(\`rejects \${scenario.kind} collisions\`, () => {
          test.fail(true)
        })
      }
      test(prefix + ' teardown', () => test.fail(true))
    `

    expect(
      inspectSource(source, 'browser_tests/computed-title.spec.ts').map(
        ({ id }) => id
      )
    ).toEqual([
      'playwright:browser_tests/computed-title.spec.ts:<expression:`rejects ${scenario.kind} collisions`>:1',
      "playwright:browser_tests/computed-title.spec.ts:<expression:prefix + ' teardown'>:1"
    ])
  })

  it('recognizes aliased, extended, and merged Playwright runners', () => {
    const source = `
      import { baseFixture as runner } from '@e2e/fixtures/baseFixture'
      const extended = runner.extend({})
      const merged = mergeTests(extended, anotherFixture)
      merged('known defect', () => merged.fail(true))
    `

    expect(inspectSource(source, 'browser_tests/fixture.spec.ts')).toEqual([
      {
        id: 'playwright:browser_tests/fixture.spec.ts:known defect:1',
        kind: 'playwright',
        file: 'browser_tests/fixture.spec.ts',
        line: 5,
        title: 'known defect'
      }
    ])
  })

  it('recognizes Playwright failures in app e2e suites', () => {
    const source = `
      test('known app defect', () => test.fail(true))
      test.fail('declared app defect', () => {})
    `

    expect(inspectSource(source, 'apps/website/e2e/example.spec.ts')).toEqual([
      {
        id: 'playwright:apps/website/e2e/example.spec.ts:known app defect:1',
        kind: 'playwright',
        file: 'apps/website/e2e/example.spec.ts',
        line: 2,
        title: 'known app defect'
      },
      {
        id: 'playwright:apps/website/e2e/example.spec.ts:declared app defect:1',
        kind: 'playwright',
        file: 'apps/website/e2e/example.spec.ts',
        line: 3,
        title: 'declared app defect'
      }
    ])
  })

  it('does not classify extended Vitest runners as Playwright failures', () => {
    const source = `
      const customTest = test.extend({})
      customTest.fails('known defect', () => {})
    `

    expect(inspectSource(source, 'src/example.test.ts')).toEqual([
      {
        id: 'vitest:src/example.test.ts:known defect:1',
        kind: 'vitest',
        file: 'src/example.test.ts',
        line: 3,
        title: 'known defect'
      }
    ])
  })
})
