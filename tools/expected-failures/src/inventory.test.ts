import { describe, expect, it } from 'vitest'

import { compareBaseline, inspectSource } from './inventory'

describe('expected failure inventory', () => {
  it('ignores test-shaped calls in production source files', () => {
    expect(
      inspectSource(
        `const test = { fails: () => undefined }; test.fails('not a test')`,
        'src/test-support.ts'
      )
    ).toEqual([])
  })

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

  it('uses the enclosing title for callback-form test.fail', () => {
    const inventoryId = (title: string) =>
      inspectSource(
        `
          test('${title}', () => {
            test.fail(({ browserName }) => browserName === 'webkit')
          })
        `,
        'browser_tests/callback-condition.spec.ts'
      )[0].id

    expect(inventoryId('old title')).toBe(
      'playwright:browser_tests/callback-condition.spec.ts:old title:1'
    )
    expect(inventoryId('new title')).toBe(
      'playwright:browser_tests/callback-condition.spec.ts:new title:1'
    )
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

describe('expected failure baseline comparison', () => {
  const pin = (id: string) => ({
    id,
    kind: 'vitest' as const,
    file: 'src/example.test.ts',
    line: 1,
    title: id
  })
  const entry = (
    id: string,
    classification: 'live-defect' | 'infrastructure-assertion' = 'live-defect'
  ) => ({ id, classification })

  it.for([
    {
      name: 'matches an exact baseline at the ceiling',
      inventory: [pin('a'), pin('b')],
      entries: [entry('a'), entry('b', 'infrastructure-assertion')],
      ceiling: 1,
      errors: []
    },
    {
      name: 'rejects an unclassified pin',
      inventory: [pin('a'), pin('new')],
      entries: [entry('a')],
      ceiling: 1,
      errors: ['Unclassified expected failure: src/example.test.ts:1 — new']
    },
    {
      name: 'rejects a resolved pin left in the baseline',
      inventory: [pin('a')],
      entries: [entry('a'), entry('fixed', 'infrastructure-assertion')],
      ceiling: 1,
      errors: ['Resolved or renamed expected failure still in baseline: fixed']
    },
    {
      name: 'rejects a ceiling above the live-defect count',
      inventory: [pin('a')],
      entries: [entry('a')],
      ceiling: 2,
      errors: [
        'Live-defect count 1 must equal LIVE_DEFECT_CEILING (2); lower it when a pin is fixed or raise it to admit a new live defect.'
      ]
    },
    {
      name: 'rejects a ceiling below the live-defect count',
      inventory: [pin('a'), pin('b')],
      entries: [entry('a'), entry('b')],
      ceiling: 1,
      errors: [
        'Live-defect count 2 must equal LIVE_DEFECT_CEILING (1); lower it when a pin is fixed or raise it to admit a new live defect.'
      ]
    }
  ])('$name', ({ inventory, entries, ceiling, errors }) => {
    expect(compareBaseline(inventory, entries, ceiling).errors).toEqual(errors)
  })

  const liveDefects = (count: number) => {
    const ids = Array.from({ length: count }, (_, index) => `live-${index}`)
    return { inventory: ids.map(pin), entries: ids.map((id) => entry(id)) }
  }

  it.for([
    { name: 'accepts', count: 16, errors: [] },
    {
      name: 'rejects',
      count: 17,
      errors: [
        'Live-defect count 17 must equal LIVE_DEFECT_CEILING (16); lower it when a pin is fixed or raise it to admit a new live defect.'
      ]
    }
  ])(
    '$name $count live defects against the default ceiling the CLI uses',
    ({ count, errors }) => {
      const { inventory, entries } = liveDefects(count)

      expect(compareBaseline(inventory, entries).errors).toEqual(errors)
    }
  )

  it('rejects duplicate baseline IDs', () => {
    expect(() =>
      compareBaseline([pin('a')], [entry('a'), entry('a')], 2)
    ).toThrow('duplicate IDs')
  })
})
