import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'

import { useSignInController } from '@/auth/useSignInController'

const h = vi.hoisted(() => ({
  resolveIdentity: vi.fn(),
  ensureFresh: vi.fn(async () => ({ status: 'ok' as const }))
}))

vi.mock<unknown>(import('@/config/firebase'), () => ({
  resolveBillingWebIdentity: h.resolveIdentity
}))

vi.mock<unknown>(import('@/session/billingWebSession'), async () => {
  const { computed, ref } = await import('vue')
  return {
    useBillingWebSession: () => ({
      user: ref(null),
      phase: computed(() => 'pending'),
      session: computed(() => undefined)
    }),
    billingWebSessionClient: () => ({ ensureFresh: h.ensureFresh })
  }
})

function makeIdentity(): FirebaseIdentity {
  return {
    signInWithGoogle: vi.fn(async () => ({
      user: { uid: 'uid-1' }
    }))
  } as unknown as FirebaseIdentity
}

beforeEach(() => {
  h.resolveIdentity.mockReset()
  h.ensureFresh.mockClear()
})

describe('useSignInController identity availability', () => {
  it('recovers from a failed startup resolution without a reload', async () => {
    const workingIdentity = makeIdentity()
    h.resolveIdentity
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(workingIdentity)

    const controller = useSignInController(() => undefined)
    await vi.waitFor(() => expect(controller.available.value).toBe(false))

    await controller.retryAvailability()

    expect(controller.available.value).toBe(true)
    await controller.signInWith('google')
    expect(workingIdentity.signInWithGoogle).toHaveBeenCalledOnce()
  })

  it('stays unavailable until the retry is invoked', async () => {
    h.resolveIdentity.mockResolvedValue(undefined)

    const controller = useSignInController(() => undefined)
    await vi.waitFor(() => expect(controller.available.value).toBe(false))

    expect(h.resolveIdentity).toHaveBeenCalledOnce()
  })
})
