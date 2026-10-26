import {
  customerCanActHere,
  pendingOperationActionHold,
  reduceBillingOperation
} from '@comfyorg/account-core/billing'
import type {
  BillingOperationEvent,
  BillingOperationState
} from '@comfyorg/account-core/billing'
import { describe, expect, it } from 'vitest'

import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

import { legacyOperationActionHold } from './customerAttention'

type Served = Omit<BillingOpStatusResponse, 'id' | 'status' | 'started_at'>

interface Scenario {
  /** The tab can drive an embedded challenge: SDK embedded, legacy flag on. */
  readonly embedded: boolean
  readonly served: readonly Served[]
  /** This tab ran the challenge from the first response and it failed. */
  readonly challengeFailed?: boolean
}

function response(served: Served): BillingOpStatusResponse {
  return { id: 'op-1', status: 'pending', started_at: '', ...served }
}

function sdkCanAct({ embedded, served, challengeFailed }: Scenario): boolean {
  const initial: BillingOperationState = {
    id: 'op-1',
    kind: 'subscription',
    scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
    observedAt: 0,
    attemptStartedAt: 0,
    phase: 'pending',
    customerActionSeen: false,
    ...(embedded
      ? { presentation: 'embedded' }
      : { presentation: 'hosted', hostedDestination: 'stripe' })
  }
  const events: BillingOperationEvent[] = served.flatMap((s, index) => [
    { type: 'status_polled', status: response(s) },
    ...(challengeFailed && index === 0
      ? ([
          { type: 'challenge_started' },
          { type: 'challenge_settled', outcome: 'failed' }
        ] as const)
      : [])
  ])
  const state = events.reduce(reduceBillingOperation, initial)
  if (state.phase !== 'pending') throw new Error(`settled as ${state.phase}`)
  return customerCanActHere(pendingOperationActionHold(state))
}

// Mirrors the store's poll: authentication state and client secret are read
// only with embedded checkout on, and the latest response wins.
function legacyCanAct({ embedded, served }: Scenario): boolean {
  const latest = served[served.length - 1]
  return customerCanActHere(
    legacyOperationActionHold(
      {
        actionUrl: latest.action_url ?? null,
        authenticationState: embedded
          ? (latest.authentication_state ?? null)
          : null,
        isAuthenticating: false
      },
      embedded && served.some((s) => s.payment_intent_client_secret)
    )
  )
}

const SECRET = { payment_intent_client_secret: 'pi_secret' } as const
const LINK = { action_url: 'https://checkout.stripe.test/pay' } as const
const BLOCKED = { phase: 'awaiting_invoice_payment' } as const

describe('customer-can-act parity across the billing rails', () => {
  it.for<[string, Scenario, boolean]>([
    [
      'an embedded challenge with its secret',
      {
        embedded: true,
        served: [
          { ...BLOCKED, authentication_state: 'requires_action', ...SECRET }
        ]
      },
      true
    ],
    [
      'an embedded challenge whose secret this tab never receives',
      {
        embedded: true,
        served: [{ ...BLOCKED, authentication_state: 'requires_action' }]
      },
      false
    ],
    [
      'a blocked phase whose authentication state still reads processing',
      {
        embedded: true,
        served: [{ ...BLOCKED, authentication_state: 'processing', ...SECRET }]
      },
      false
    ],
    [
      'an embedded retryable decline with a reason',
      {
        embedded: true,
        served: [
          {
            authentication_state: 'failed_retryable',
            decline_reason: 'card_declined'
          }
        ]
      },
      true
    ],
    [
      'an embedded retryable failure without a reason',
      {
        embedded: true,
        served: [{ authentication_state: 'failed_retryable' }]
      },
      true
    ],
    [
      'a hosted retryable failure with a page to retry on',
      {
        embedded: false,
        served: [{ authentication_state: 'failed_retryable', ...LINK }]
      },
      true
    ],
    [
      'an embedded challenge offered beside a hosted page',
      {
        embedded: true,
        served: [
          { authentication_state: 'requires_action', ...SECRET, ...LINK }
        ]
      },
      true
    ],
    [
      'a hosted page with embedded checkout off',
      { embedded: false, served: [{ ...BLOCKED, ...LINK }] },
      true
    ],
    [
      'a hosted operation blocked before its page exists',
      { embedded: false, served: [BLOCKED] },
      false
    ],
    [
      'a challenge served to a tab with embedded checkout off',
      {
        embedded: false,
        served: [
          { ...BLOCKED, authentication_state: 'requires_action', ...SECRET }
        ]
      },
      false
    ],
    [
      'a challenge the server now reads processing',
      {
        embedded: true,
        served: [
          { authentication_state: 'requires_action', ...SECRET },
          { ...BLOCKED, authentication_state: 'processing' }
        ]
      },
      false
    ],
    [
      'a failed challenge the server then reads processing',
      {
        embedded: true,
        served: [
          { ...BLOCKED, authentication_state: 'requires_action', ...SECRET },
          { ...BLOCKED, authentication_state: 'processing' }
        ],
        challengeFailed: true
      },
      false
    ]
  ])('%s', ([, scenario, canAct]) => {
    expect({
      sdk: sdkCanAct(scenario),
      legacy: legacyCanAct(scenario)
    }).toEqual({ sdk: canAct, legacy: canAct })
  })

  it.for<[string, Scenario, { sdk: boolean; legacy: boolean }]>([
    [
      'only a hosted page, which the SDK embedded surface never opens',
      {
        embedded: true,
        served: [
          { ...BLOCKED, authentication_state: 'requires_action', ...LINK }
        ]
      },
      { sdk: false, legacy: true }
    ],
    [
      'a retryable decline the legacy store never reads with embedded checkout off',
      {
        embedded: false,
        served: [
          {
            authentication_state: 'failed_retryable',
            decline_reason: 'card_declined'
          }
        ]
      },
      { sdk: true, legacy: false }
    ]
  ])('differs by surface on %s', ([, scenario, expected]) => {
    expect({
      sdk: sdkCanAct(scenario),
      legacy: legacyCanAct(scenario)
    }).toEqual(expected)
  })
})
