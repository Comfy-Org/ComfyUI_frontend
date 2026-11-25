import { describe, expect, it } from 'vitest'

import { subscribeToRunDialogOptions } from './subscribeToRunDialogOptions'

describe('subscribeToRunDialogOptions', () => {
  it.for(['never_subscribed', 'ended'] as const)(
    'says the credits are locked for a funded account in state %s',
    (subscriptionState) => {
      expect(
        subscribeToRunDialogOptions({ subscriptionState, hasFunds: true })
      ).toEqual({ reason: 'subscribe_to_run', creditsLocked: true })
    }
  )

  it.for([
    {
      name: 'no funds',
      subscriptionState: 'never_subscribed',
      hasFunds: false
    },
    { name: 'a paused plan', subscriptionState: 'paused', hasFunds: true },
    { name: 'a past-due plan', subscriptionState: 'past_due', hasFunds: true },
    { name: 'an active plan', subscriptionState: 'active', hasFunds: true },
    { name: 'an unknown state', subscriptionState: null, hasFunds: true },
    {
      name: 'billing not loaded',
      subscriptionState: null,
      hasFunds: undefined
    }
  ] as const)(
    'opens the plain subscribe dialog with $name',
    ({ subscriptionState, hasFunds }) => {
      expect(
        subscribeToRunDialogOptions({ subscriptionState, hasFunds })
      ).toEqual({ reason: 'subscribe_to_run' })
    }
  )
})
