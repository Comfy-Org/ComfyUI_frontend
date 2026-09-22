import type { CloudFeatures } from '@comfyorg/account-core/firebaseConfigSource'

const h = vi.hoisted(() => ({
  fetchCloudFeatures: vi.fn<() => Promise<CloudFeatures>>()
}))

vi.mock(import('@comfyorg/account-core/firebaseConfigSource'), () => ({
  fetchCloudFeatures: h.fetchCloudFeatures
}))

vi.mock(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

async function freshCloudFeatures() {
  vi.resetModules()
  return import('@/config/cloudFeatures')
}

describe('resolveBillingWebFeatures', () => {
  it('fetches the document once and shares it across every caller', async () => {
    const features: CloudFeatures = { stripePublishableKey: 'pk_server' }
    h.fetchCloudFeatures.mockResolvedValue(features)
    const { resolveBillingWebFeatures } = await freshCloudFeatures()

    const [first, second] = await Promise.all([
      resolveBillingWebFeatures(),
      resolveBillingWebFeatures()
    ])

    expect(first).toBe(features)
    expect(second).toBe(features)
    expect(h.fetchCloudFeatures).toHaveBeenCalledOnce()
  })
})
