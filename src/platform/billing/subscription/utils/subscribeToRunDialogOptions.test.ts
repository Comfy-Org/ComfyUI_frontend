import { describe, expect, it } from 'vitest'

import { subscribeToRunDialogOptions } from './subscribeToRunDialogOptions'

describe('subscribeToRunDialogOptions', () => {
  it('says the credits are locked when the inactive account holds funds', () => {
    expect(
      subscribeToRunDialogOptions({ isActive: false, hasFunds: true })
    ).toEqual({
      reason: 'subscribe_to_run',
      creditsLocked: true
    })
  })

  it.for([
    { name: 'no funds', subscription: { isActive: false, hasFunds: false } },
    {
      name: 'an active plan that cannot run',
      subscription: { isActive: true, hasFunds: true }
    },
    { name: 'billing not loaded', subscription: null }
  ])('opens the plain subscribe dialog with $name', ({ subscription }) => {
    expect(subscribeToRunDialogOptions(subscription)).toEqual({
      reason: 'subscribe_to_run'
    })
  })
})
