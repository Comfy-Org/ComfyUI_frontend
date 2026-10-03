import { planCreditsSettingsUrl } from '@/checkout/cloudLinks'

vi.mock<unknown>(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

describe('planCreditsSettingsUrl', () => {
  it.for<{ name: string; workspace: string | undefined; href: string }>([
    {
      name: 'opens the panel in the billed workspace',
      workspace: 'ws_1',
      href: 'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws_1'
    },
    {
      name: 'names no workspace when none is bound',
      workspace: undefined,
      href: 'https://testcloud.comfy.org/?settings=plan-credits'
    }
  ])('$name', ({ workspace, href }) => {
    expect(planCreditsSettingsUrl(workspace)).toBe(href)
  })
})
