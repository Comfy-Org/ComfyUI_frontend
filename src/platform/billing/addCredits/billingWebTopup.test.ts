import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'

import { billingWebTopupUrl } from './billingWebTopup'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => 'https://cloud.comfy.org'
}))

const query = (url: string | undefined) =>
  url === undefined
    ? undefined
    : Object.fromEntries(new URL(url).searchParams.entries())

describe('billingWebTopupUrl', () => {
  beforeEach(() => {
    useRemoteConfigStore().acceptConfig(
      { billing_web_url: 'https://billing.comfy.org' },
      false
    )
  })

  it.for([
    {
      name: 'the amount and workspace',
      autoTopUp: undefined,
      expected: {}
    },
    {
      name: 'auto top-up with a monthly limit',
      autoTopUp: {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: 10_000
      },
      expected: {
        auto_top_up_threshold_credits: '1000',
        auto_top_up_target_credits: '11550',
        auto_top_up_monthly_budget_cents: '10000'
      }
    },
    {
      name: 'auto top-up with no monthly limit',
      autoTopUp: {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: null
      },
      expected: {
        auto_top_up_threshold_credits: '1000',
        auto_top_up_target_credits: '11550'
      }
    }
  ])('opens the top-up page with $name', ({ autoTopUp, expected }) => {
    const url = billingWebTopupUrl(5000, autoTopUp, 'ws-1', 'tpp_1')

    expect(url?.startsWith('https://billing.comfy.org/v1/top-up?')).toBe(true)
    expect(query(url)).toEqual({
      product: 'comfyui',
      return_to: 'comfyui_workspace',
      amount_cents: '5000',
      workspace: 'ws-1',
      purchase: 'tpp_1',
      ...expected
    })
  })

  it('has no page when this host has no billing-web origin', () => {
    useRemoteConfigStore().acceptConfig({}, false)

    expect(billingWebTopupUrl(5000, undefined, 'ws-1', 'tpp_1')).toBeUndefined()
  })
})
