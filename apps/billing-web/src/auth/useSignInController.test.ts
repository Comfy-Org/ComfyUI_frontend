import { fromAny } from '@total-typescript/shoehorn'
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { AccountUser } from '@comfyorg/account-core/session'
import type { Ref } from 'vue'

import { useSignInController } from '@/auth/useSignInController'
import { bindEntryWorkspace } from '@/entry/workspaceBinding'

const h = vi.hoisted(() => ({
  resolveIdentity: vi.fn<() => Promise<unknown>>(),
  ensureFresh: vi.fn(async () => ({ status: 'ok' as const })),
  user: undefined as Ref<AccountUser | null> | undefined
}))

vi.mock<unknown>(import('@/config/firebase'), () => ({
  resolveBillingWebIdentity: h.resolveIdentity
}))

vi.mock<unknown>(import('@/session/billingWebSession'), async () => {
  const { computed, ref } = await import('vue')
  h.user = ref<AccountUser | null>(null)
  return {
    useBillingWebSession: () => ({
      user: h.user,
      phase: computed(() => 'pending'),
      session: computed(() => undefined)
    }),
    billingWebSessionClient: () => ({ ensureFresh: h.ensureFresh })
  }
})

function makeIdentity(): FirebaseIdentity {
  return fromAny<FirebaseIdentity, unknown>({
    signInWithGoogle: vi.fn(async () => ({
      user: { uid: 'uid-1' }
    }))
  })
}

function signedInUser(): AccountUser {
  return { uid: 'uid-1', getIdToken: vi.fn(async () => 'id-token') }
}

beforeEach(() => {
  sessionStorage.clear()
  h.resolveIdentity.mockReset()
  h.ensureFresh.mockClear()
  if (h.user) h.user.value = null
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

describe('mint workspace targeting', () => {
  it('mints for the workspace bound while signed out, not the one the client constructed for', async () => {
    h.resolveIdentity.mockResolvedValue(undefined)
    const controller = useSignInController(() => undefined)

    // A later entry link rebinds the tab to B before anybody has signed in,
    // then the user is restored: `mint()` must read the binding live at that
    // moment, not whatever it was when the client (or this controller) was
    // constructed.
    bindEntryWorkspace('ws-b')
    h.user!.value = signedInUser()

    await vi.waitFor(() => expect(controller.state.value.step).toBe('signedIn'))
    expect(h.ensureFresh).toHaveBeenCalledWith(undefined, {
      workspaceId: 'ws-b'
    })
  })
})
