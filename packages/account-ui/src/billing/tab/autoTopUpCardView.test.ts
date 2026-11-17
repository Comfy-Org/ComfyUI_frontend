import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { AutoTopUpOffView } from '@comfyorg/account-core/billing'

import { autoTopUpViewKey } from './autoTopUpCardView'
import type { AutoTopUpViewKey } from './autoTopUpCardView'
import {
  configuredSettings,
  notConfiguredSettings
} from './__fixtures__/autoTopUpSettings'

describe('autoTopUpViewKey', () => {
  it.for<{
    case: string
    settings: Parameters<typeof autoTopUpViewKey>[0]
    offView?: AutoTopUpOffView
    key: AutoTopUpViewKey
  }>([
    { case: 'on', settings: configuredSettings, key: 'on' },
    {
      case: 'failed',
      settings: { ...configuredSettings, status: 'failed' },
      key: 'failed'
    },
    {
      case: 'failed after consecutive declines',
      settings: {
        ...configuredSettings,
        status: 'failed',
        disabled_reason: 'consecutive_declines'
      },
      key: 'turnedOff'
    },
    {
      case: 'paused by a custom budget',
      settings: { ...configuredSettings, status: 'paused_by_budget' },
      key: 'paused_by_budget'
    },
    {
      case: 'paused by the default budget',
      settings: {
        ...configuredSettings,
        status: 'paused_by_budget',
        monthly_budget_is_default: true
      },
      key: 'maximumReached'
    },
    {
      case: 'on hold',
      settings: { ...configuredSettings, status: 'on_hold' },
      key: 'on_hold'
    },
    { case: 'off', settings: notConfiguredSettings, key: 'off' },
    {
      case: 'off without a payment method',
      settings: notConfiguredSettings,
      offView: 'noPaymentMethod',
      key: 'noPaymentMethod'
    },
    {
      case: 'off without a default payment method',
      settings: notConfiguredSettings,
      offView: 'noDefaultPaymentMethod',
      key: 'noDefaultPaymentMethod'
    },
    {
      case: 'an unknown served status',
      settings: fromAny({ ...configuredSettings, status: 'paused_by_admin' }),
      offView: 'noPaymentMethod',
      key: 'off'
    },
    {
      case: 'the off view for a status that is not off',
      settings: configuredSettings,
      offView: 'noPaymentMethod',
      key: 'on'
    }
  ])('reads $case as $key', ({ settings, offView = 'off', key }) => {
    expect(autoTopUpViewKey(settings, offView)).toBe(key)
  })
})
