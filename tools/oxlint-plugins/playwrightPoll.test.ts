import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noThrowInExpectPoll } from './playwrightPoll'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-throw-in-expect-poll', noThrowInExpectPoll, {
  valid: [
    {
      name: 'a poll callback that returns a sentinel',
      code: `await expect.poll(async () => (await read()) ?? null).toBe(1)`
    },
    {
      name: 'a throw in a nested function, a toPass block, and a later argument',
      code: `
await expect.poll(async () => {
  const fail = () => { throw new Error('later') }
  return fail
}).toBeDefined()
await expect(async () => { throw new Error('retried') }).toPass()
await expect.poll(read, { message: (() => { throw new Error('x') })() })
`
    }
  ],
  invalid: [
    {
      name: 'throws inside expect.poll and renamed expect objects',
      code: `
await expect.poll(async () => {
  const host = await readHost()
  if (!host) throw new Error('host not ready')
  return host.value
}).toBe(1)
await softExpect.poll(() => { throw new Error('soft') }).toBe(1)
await cloudAppExpect.poll(function () { throw new Error('cloud') }).toBe(1)
`,
      errors: [
        { messageId: 'throwInPoll' },
        { messageId: 'throwInPoll' },
        { messageId: 'throwInPoll' }
      ]
    }
  ]
})
