const h = vi.hoisted(() => ({
  fetchFirebaseConfig: vi.fn(),
  fallbackOptions: undefined as
    | { apiKey: string; authDomain: string; projectId: string; appId: string }
    | undefined
}))

vi.mock<unknown>(import('@comfyorg/account-core/firebaseConfigSource'), () => ({
  fetchFirebaseConfig: h.fetchFirebaseConfig
}))

vi.mock<unknown>(import('@comfyorg/account-core/firebase'), () => ({
  createFirebaseIdentity: (config: { options: unknown }) => ({
    kind: 'identity',
    options: config.options
  })
}))

vi.mock<unknown>(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org',
  get FIREBASE_OPTIONS() {
    return h.fallbackOptions
  }
}))

const RUNTIME_OPTIONS = {
  apiKey: 'runtime-key',
  authDomain: 'runtime.firebaseapp.com',
  projectId: 'runtime',
  appId: '1:1:web:runtime'
}

const FALLBACK_OPTIONS = {
  apiKey: 'fallback-key',
  authDomain: 'fallback.firebaseapp.com',
  projectId: 'fallback',
  appId: '1:1:web:fallback'
}

beforeEach(() => {
  h.fallbackOptions = undefined
})

async function freshFirebase() {
  vi.resetModules()
  return import('@/config/firebase')
}

describe('resolveBillingWebIdentity', () => {
  it('prefers the runtime configuration when the fetch returns one', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    h.fallbackOptions = FALLBACK_OPTIONS
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toEqual({
      kind: 'identity',
      options: RUNTIME_OPTIONS
    })
  })

  it('falls back to the build-time options when the fetch returns nothing', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(undefined)
    h.fallbackOptions = FALLBACK_OPTIONS
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toEqual({
      kind: 'identity',
      options: FALLBACK_OPTIONS
    })
  })

  it('offers no identity when neither source is configured', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(undefined)
    h.fallbackOptions = undefined
    const { resolveBillingWebIdentity } = await freshFirebase()

    await expect(resolveBillingWebIdentity()).resolves.toBeUndefined()
  })

  it('fetches once and shares the resolution across callers', async () => {
    h.fetchFirebaseConfig.mockResolvedValue(RUNTIME_OPTIONS)
    const { resolveBillingWebIdentity } = await freshFirebase()

    await Promise.all([
      resolveBillingWebIdentity(),
      resolveBillingWebIdentity()
    ])

    expect(h.fetchFirebaseConfig).toHaveBeenCalledOnce()
  })
})
