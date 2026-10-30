import { remoteConfig } from './remoteConfig'
import {
  clearCloudBillingFlags,
  refreshCloudBillingFlags
} from './cloudBillingFlags'

const ingest = vi.hoisted(() => ({
  get: vi.fn(),
  requestAuth: vi.fn()
}))

vi.mock<unknown>(import('@/platform/remote/ingest/ingestApi'), () => ({
  ingestApiClient: { get: ingest.get },
  requestAuth: ingest.requestAuth
}))

vi.mock(import('@/platform/remote/ingest/ingestApiUrl'), () => ({
  ingestApiUrl: (route: string) => `https://cloud.comfy.org/api${route}`
}))

const AUTH = { headers: { Authorization: 'Bearer workspace-token' } }

const CLOUD_FEATURES = {
  unified_billing_settings: true,
  hosted_billing_destination: 'billing_web',
  billing_web_url: 'https://billing.comfy.org',
  billing_control_enabled: true,
  comfy_api_base_url: 'https://cloud-api.example'
}

describe('refreshCloudBillingFlags', () => {
  beforeEach(() => {
    remoteConfig.value = { comfy_api_base_url: 'https://api.comfy.org' }
    ingest.requestAuth.mockResolvedValue(AUTH)
    ingest.get.mockResolvedValue({ data: CLOUD_FEATURES })
  })

  it("reads the signed-in user's Cloud features with the workspace credentials", async () => {
    await refreshCloudBillingFlags()

    expect(ingest.get).toHaveBeenCalledWith(
      'https://cloud.comfy.org/api/features',
      AUTH
    )
  })

  it('adds only the billing keys and keeps the local server config', async () => {
    await refreshCloudBillingFlags()

    expect(remoteConfig.value).toEqual({
      comfy_api_base_url: 'https://api.comfy.org',
      unified_billing_settings: true,
      hosted_billing_destination: 'billing_web',
      billing_web_url: 'https://billing.comfy.org'
    })
  })

  it('drops keys Cloud stopped serving for this user', async () => {
    await refreshCloudBillingFlags()
    ingest.get.mockResolvedValue({ data: { unified_billing_settings: false } })

    await refreshCloudBillingFlags()

    expect(remoteConfig.value).toEqual({
      comfy_api_base_url: 'https://api.comfy.org',
      unified_billing_settings: false
    })
  })

  it('leaves the billing keys unset when Cloud cannot be read', async () => {
    await refreshCloudBillingFlags()
    ingest.get.mockRejectedValue(new Error('network'))

    await refreshCloudBillingFlags()

    expect(remoteConfig.value).toEqual({
      comfy_api_base_url: 'https://api.comfy.org'
    })
  })

  it("does not apply a signed-out user's answer that arrives after sign-out", async () => {
    let answer: (value: { data: typeof CLOUD_FEATURES }) => void = () => {}
    ingest.get.mockReturnValue(new Promise((resolve) => (answer = resolve)))

    const pending = refreshCloudBillingFlags()
    await Promise.resolve()
    clearCloudBillingFlags()
    answer({ data: CLOUD_FEATURES })
    await pending

    expect(remoteConfig.value).toEqual({
      comfy_api_base_url: 'https://api.comfy.org'
    })
  })
})
