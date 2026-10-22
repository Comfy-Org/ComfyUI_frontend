import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { preferArrayContaining } from './arrayContaining'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('prefer-array-containing', preferArrayContaining, {
  valid: [
    {
      name: 'order-free comparisons and sorts that are not comparisons',
      code: `
expect(names).toEqual(expect.arrayContaining(['b', 'a']))
expect(names).toEqual([b, a].sort())
expect(names).toEqual(['b', 'a'].sort(compareNames))
expect(rank(items.sort(byScore))).toBe(1)
const ordered = items.toSorted()
expect(names).toEqual([].sort())
`
    }
  ],
  invalid: [
    {
      name: 'sorting the subject of expect',
      code: `
expect([...AGENT_WS_EVENT_TYPES].sort()).toEqual(['a', 'b'])
expect(names.toSorted()).toEqual(expected)
`,
      errors: [
        { messageId: 'sortedComparison' },
        { messageId: 'sortedComparison' }
      ]
    },
    {
      name: 'sorting a literal array of strings or numbers',
      code: `
expect(names).toEqual(['charlie', 'alpha'].sort())
expect(sizes).toEqual([10, 9, \`1\`].toSorted())
`,
      errors: [
        { messageId: 'sortedComparison' },
        { messageId: 'sortedComparison' }
      ]
    }
  ]
})
