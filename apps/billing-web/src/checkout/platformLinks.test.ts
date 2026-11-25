import { platformBillingUrl, platformPlansUrl } from '@/checkout/platformLinks'

vi.mock<unknown>(import('@/config/env'), () => ({
  PLATFORM_BASE_URL: 'https://testplatform.comfy.org'
}))

const PLANS = 'https://testplatform.comfy.org/settings/billing/plans'

describe('platformPlansUrl', () => {
  it.for<{
    name: string
    arrival: Parameters<typeof platformPlansUrl>[0]
    asksTeam?: boolean
    href: string
  }>([
    {
      name: 'opens Plans in the billed workspace',
      arrival: {},
      href: `${PLANS}?workspace=ws_1`
    },
    {
      name: 'opens the Team tab on the stop a team link named',
      arrival: { teamCreditStopId: 'team_700' },
      href: `${PLANS}?pricing=team&stop=team_700&workspace=ws_1`
    },
    {
      name: 'opens the Team tab without a stop when asked for a team plan',
      arrival: {},
      asksTeam: true,
      href: `${PLANS}?pricing=team&workspace=ws_1`
    },
    {
      name: 'keeps the journey the link carried',
      arrival: { correlationId: 'cj_1' },
      href: `${PLANS}?correlation_id=cj_1&workspace=ws_1`
    }
  ])('$name', ({ arrival, asksTeam, href }) => {
    expect(platformPlansUrl(arrival, 'ws_1', asksTeam)).toBe(href)
  })

  it('names no workspace when none is bound', () => {
    expect(platformPlansUrl(undefined, undefined)).toBe(PLANS)
  })
})

describe('platformBillingUrl', () => {
  it.for<{ name: string; workspace: string | undefined; href: string }>([
    {
      name: 'opens Billing in the billed workspace',
      workspace: 'ws_1',
      href: 'https://testplatform.comfy.org/settings/billing?workspace=ws_1'
    },
    {
      name: 'names no workspace when none is bound',
      workspace: undefined,
      href: 'https://testplatform.comfy.org/settings/billing'
    }
  ])('$name', ({ workspace, href }) => {
    expect(platformBillingUrl(workspace)).toBe(href)
  })
})
