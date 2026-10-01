import type { BillingWebSessionPhase } from '@/router'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'
import {
  reportSessionFailed,
  reportSigninRequired
} from '@/telemetry/webSessionTelemetry'

function trackedEvents() {
  const track = vi
    .spyOn(billingWebTelemetry, 'trackBillingEvent')
    .mockImplementation(() => undefined)
  return () => track.mock.calls.map(([event]) => event)
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('the sign-in screen', () => {
  it.for([
    { phase: 'signed-out', reason: 'no_session' },
    { phase: 'error', reason: 'refused' }
  ] as const)(
    'is reported as required, $reason, once the session is $phase',
    ({ phase, reason }) => {
      const sent = trackedEvents()

      reportSigninRequired(phase)

      expect(sent()).toStrictEqual([
        {
          operation: 'web_session',
          stage: 'signin_required',
          outcome: 'pending',
          reason
        }
      ])
    }
  )

  it.for<BillingWebSessionPhase | undefined>([
    undefined,
    'pending',
    'minting',
    'authenticated'
  ])('is not reported while the session is %s', (phase) => {
    const sent = trackedEvents()

    reportSigninRequired(phase)

    expect(sent()).toStrictEqual([])
  })

  it('is reported once however the session moves after', () => {
    const sent = trackedEvents()

    reportSigninRequired('signed-out')
    reportSigninRequired('error')
    reportSigninRequired('signed-out')

    expect(sent()).toHaveLength(1)
  })
})

describe('a failed session', () => {
  it('is reported once for each code the tab meets', () => {
    const sent = trackedEvents()

    reportSessionFailed('ACCESS_DENIED')
    reportSessionFailed('ACCESS_DENIED')
    reportSessionFailed('TOKEN_EXCHANGE_FAILED')
    reportSessionFailed('ACCESS_DENIED')

    expect(sent()).toStrictEqual([
      {
        operation: 'web_session',
        stage: 'failed',
        outcome: 'pending',
        code: 'ACCESS_DENIED'
      },
      {
        operation: 'web_session',
        stage: 'failed',
        outcome: 'pending',
        code: 'TOKEN_EXCHANGE_FAILED'
      }
    ])
  })
})
