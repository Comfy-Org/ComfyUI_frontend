import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noSortedLiteralArray } from './sortedLiteralArray'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-sorted-literal-array', noSortedLiteralArray, {
  valid: [
    {
      name: 'sorting values the test does not spell out, or with a comparator',
      code: `
expect(names.sort()).toEqual(expected)
expect(names).toEqual([b, a].sort())
expect(names).toEqual(['b', 'a'].sort(compareNames))
expect(names).toEqual([...seeded].sort())
expect(names).toEqual([\`\${prefix}b\`, 'a'].sort())
expect(names).toEqual([].sort())
`
    }
  ],
  invalid: [
    {
      name: 'string literals are written in sorted order',
      code: `expect(names).toEqual(['charlie', 'alpha', 'Bravo'].sort())`,
      output: `expect(names).toEqual(['Bravo', 'alpha', 'charlie'])`,
      errors: [{ messageId: 'sortedLiteral' }]
    },
    {
      name: 'numbers keep the default string ordering of sort()',
      code: `expect(sizes).toEqual([10, 9, 1].toSorted())`,
      output: `expect(sizes).toEqual([1, 10, 9])`,
      errors: [{ messageId: 'sortedLiteral' }]
    }
  ]
})
