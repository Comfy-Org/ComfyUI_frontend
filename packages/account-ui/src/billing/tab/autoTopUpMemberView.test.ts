import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { autoTopUpMemberView } from './autoTopUpMemberView'
import type {
  AutoTopUpMemberBlockView,
  AutoTopUpMemberView
} from './autoTopUpMemberView'
import {
  autoTopUpMemberBlockCopy,
  memberView
} from './__fixtures__/autoTopUpCopy'

const CONTACT = 'Contact a workspace owner to manage this.'

describe('autoTopUpMemberView', () => {
  it.for<{
    case: string
    view: AutoTopUpMemberView | null | undefined
    expected: AutoTopUpMemberBlockView | null
  }>([
    {
      case: 'on',
      view: memberView({ target_credits: 12500, threshold_credits: 1000 }),
      expected: {
        status: 'on',
        line: `Tops up to 12,500 credits when below 1,000 credits. ${CONTACT}`
      }
    },
    {
      case: 'off',
      view: memberView({ status: 'off' }),
      expected: {
        status: 'off',
        line: `Credits can top up automatically when they run low. ${CONTACT}`
      }
    },
    {
      case: 'an owner-selected limit reached',
      view: memberView({ status: 'paused_by_budget' }),
      expected: {
        status: 'limitReached',
        line: `Monthly limit reached. Resets Nov 28. ${CONTACT}`
      }
    },
    {
      case: 'a limit reached without a reset date',
      view: memberView({ status: 'paused_by_budget', cycle_resets_at: null }),
      expected: {
        status: 'limitReached',
        line: `Monthly limit reached. ${CONTACT}`
      }
    },
    {
      case: 'the default maximum reached',
      view: memberView({
        status: 'paused_by_budget',
        monthly_budget_is_default: true
      }),
      expected: {
        status: 'maximumReached',
        line: `Monthly maximum reached. Resets Nov 28. ${CONTACT}`
      }
    },
    {
      case: 'the maximum reached without a reset date',
      view: memberView({
        status: 'paused_by_budget',
        monthly_budget_is_default: true,
        cycle_resets_at: null
      }),
      expected: {
        status: 'maximumReached',
        line: `Monthly maximum reached. ${CONTACT}`
      }
    },
    {
      case: 'failed',
      view: memberView({ status: 'failed' }),
      expected: {
        status: 'failed',
        line: `The last top-up didn't go through. ${CONTACT}`
      }
    },
    {
      case: 'turned off after consecutive declines',
      view: memberView({
        status: 'failed',
        disabled_reason: 'consecutive_declines'
      }),
      expected: {
        status: 'turnedOff',
        line: `Turned off after 3 declined charges. ${CONTACT}`
      }
    },
    {
      case: 'on hold',
      view: memberView({ status: 'on_hold' }),
      expected: {
        status: 'onHold',
        line: `Needs a default payment method. ${CONTACT}`
      }
    },
    {
      case: 'on without a target',
      view: memberView({ target_credits: null }),
      expected: null
    },
    {
      case: 'on without a threshold',
      view: memberView({ threshold_credits: null }),
      expected: null
    },
    {
      case: 'an unknown served status',
      view: fromAny({ ...memberView(), status: 'paused_by_admin' }),
      expected: null
    },
    { case: 'an omitted view', view: undefined, expected: null },
    { case: 'no view', view: null, expected: null }
  ])('reads $case', ({ view, expected }) => {
    expect(autoTopUpMemberView(view, autoTopUpMemberBlockCopy, 'en')).toEqual(
      expected
    )
  })
})
