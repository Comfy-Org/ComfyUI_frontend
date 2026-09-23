import { describe, expect, it } from 'vitest'

import { readBillingErrorMessage } from './billingErrorBody.js'

describe('readBillingErrorMessage', () => {
  it('reads the message of an ErrorResponse body', () => {
    expect(
      readBillingErrorMessage({
        code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS',
        message: 'a subscription change is already in progress'
      })
    ).toBe('a subscription change is already in progress')
  })

  it('trims the whitespace around a message', () => {
    expect(
      readBillingErrorMessage({
        code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS',
        message: '  a subscription change is already in progress \n'
      })
    ).toBe('a subscription change is already in progress')
  })

  it.for([
    { name: 'a body that is not an ErrorResponse', body: { error: 'nope' } },
    { name: 'an empty message', body: { code: 'X', message: '' } },
    { name: 'a whitespace message', body: { code: 'X', message: ' \t\n' } }
  ])('yields nothing for $name', ({ body }) => {
    expect(readBillingErrorMessage(body)).toBeUndefined()
  })
})
