import { describe, expect, it } from 'vitest'

import { subscribeToRunDialogOptions } from './subscribeToRunDialogOptions'

describe('subscribeToRunDialogOptions', () => {
  it('says the credits are locked when the inactive account holds funds', () => {
    expect(subscribeToRunDialogOptions({ hasFunds: true })).toEqual({
      reason: 'subscribe_to_run',
      creditsLocked: true
    })
  })

  it.for([
    { name: 'no funds', subscription: { hasFunds: false } },
    { name: 'billing not loaded', subscription: null }
  ])('opens the plain subscribe dialog with $name', ({ subscription }) => {
    expect(subscribeToRunDialogOptions(subscription)).toEqual({
      reason: 'subscribe_to_run'
    })
  })
})
