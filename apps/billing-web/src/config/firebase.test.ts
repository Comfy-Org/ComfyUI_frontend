import type {
  FirebaseIdentity,
  ResolveFirebaseIdentityOptions
} from '@comfyorg/account-core/firebase'
import { createTestIdentity } from '@comfyorg/account-core/testing'

const h = vi.hoisted(() => ({
  resolveFirebaseIdentity:
    vi.fn<
      (
        options: ResolveFirebaseIdentityOptions
      ) => Promise<FirebaseIdentity | undefined>
    >()
}))

vi.mock(import('@comfyorg/account-core/firebase'), () => ({
  resolveFirebaseIdentity: h.resolveFirebaseIdentity
}))

vi.mock(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

const testIdentity = createTestIdentity({
  onUserChanged: () => () => undefined
}) as unknown as FirebaseIdentity

beforeEach(() => {
  h.resolveFirebaseIdentity.mockReset()
})

async function freshFirebase() {
  vi.resetModules()
  return import('@/config/firebase')
}

describe('resolveBillingWebIdentity', () => {
  it("resolves this origin's Cloud base URL and app name to account-core's initializer, without picking a source or constructing anything itself", async () => {
    h.resolveFirebaseIdentity.mockResolvedValue(testIdentity)
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toBe(testIdentity)

    expect(h.resolveFirebaseIdentity).toHaveBeenCalledWith({
      cloudBaseUrl: 'https://testcloud.comfy.org',
      appName: 'billing-web',
      timeoutMs: 4000
    })
  })

  it('passes through no identity when account-core resolves none', async () => {
    h.resolveFirebaseIdentity.mockResolvedValue(undefined)
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toBeUndefined()
  })
})
