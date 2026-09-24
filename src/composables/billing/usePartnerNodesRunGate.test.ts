import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { fromPartial } from '@total-typescript/shoehorn'
import { computed, effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('firebase/auth'))

import {
  partnerRunGateBlocksAutoQueue,
  usePartnerNodesRunGate
} from './usePartnerNodesRunGate'

const state = vi.hoisted(
  () =>
    ({}) as {
      hasPartnerNodes: Ref<boolean>
      partnerNodes: Ref<{ nodeName: string; displayName: string }[]>
    }
)

vi.mock(import('@/composables/node/usePartnerNodesInGraph'), async () => {
  const { computed } = await import('vue')
  return {
    usePartnerNodesInGraph: () => ({
      partnerNodes: computed(() => state.partnerNodes.value),
      hasPartnerNodes: computed(() => state.hasPartnerNodes.value)
    }),
    scanPartnerNodesInGraph: () => state.partnerNodes.value
  }
})

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/composables/useFeatureFlags'))

beforeEach(() => {
  vi.mocked(useFeatureFlags().flags).partnerRunGateEnabled = true
})

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

let scope: EffectScope

async function storeApiKeyStillValidating() {
  vi.spyOn(useAuthStore(), 'createCustomer').mockReturnValue(
    new Promise(() => {})
  )
  await useApiKeyAuthStore().storeApiKey('stored-key')
}

function setup() {
  scope = effectScope()
  return scope.run(() => usePartnerNodesRunGate())!
}

describe('usePartnerNodesRunGate', () => {
  beforeEach(() => {
    state.hasPartnerNodes = ref(false)
    state.partnerNodes = ref([])
    useAuthStore().isInitialized = true
  })

  afterEach(() => {
    scope.stop()
  })

  it('resolves none without partner nodes', () => {
    useCurrentUser().isLoggedIn = computed(() => true)
    const { gate } = setup()
    expect(gate.value).toBe('none')
  })

  it('gates on sign-in when signed out with partner nodes', () => {
    state.hasPartnerNodes.value = true
    const { gate } = setup()
    expect(gate.value).toBe('sign-in')
  })

  it('resolves none when signed in', () => {
    state.hasPartnerNodes.value = true
    useCurrentUser().isLoggedIn = computed(() => true)
    const { gate } = setup()
    expect(gate.value).toBe('none')
  })

  it('follows partner nodes appearing and disappearing while signed out', async () => {
    const { gate } = setup()
    expect(gate.value).toBe('none')

    state.hasPartnerNodes.value = true
    await nextTick()
    expect(gate.value).toBe('sign-in')

    state.hasPartnerNodes.value = false
    await nextTick()
    expect(gate.value).toBe('none')
  })

  it('flips to sign-in when the user signs out mid-session', async () => {
    state.hasPartnerNodes.value = true
    const loggedIn = ref(true)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    const { gate } = setup()
    expect(gate.value).toBe('none')

    loggedIn.value = false
    await nextTick()
    expect(gate.value).toBe('sign-in')
  })

  it('reports each block with the trigger site and detection details', async () => {
    state.hasPartnerNodes.value = true
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    setup()
    await nextTick()

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'partner_run_gate_blocked',
        level: 'warning',
        tags: expect.objectContaining({
          trigger: 'run-button',
          partnerNodeCount: 1
        }),
        context: { partnerNodeTypes: ['Kling'] }
      })
    )
  })

  describe('tags the raw sessions so a wrongly blocked user is visible', () => {
    it.for([
      { held: 'no session', firebase: false, apiKey: false },
      { held: 'a Firebase user', firebase: true, apiKey: false },
      { held: 'a validated API key', firebase: false, apiKey: true }
    ])('while holding $held', async ({ firebase, apiKey }) => {
      useCurrentUser().isLoggedIn = computed(() => false)
      if (firebase) {
        vi.spyOn(firebaseIdentity, 'currentUser').mockReturnValue(
          fromPartial<User>({ uid: 'u1' })
        )
      }
      if (apiKey) {
        const apiKeyStore = useApiKeyAuthStore()
        vi.spyOn(apiKeyStore, 'getApiKey').mockReturnValue('stored-key')
        apiKeyStore.currentUser = fromPartial({ id: 'customer-1' })
      }
      state.hasPartnerNodes.value = true
      state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
      setup()
      await nextTick()

      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            hasFirebaseSession: firebase,
            hasStoredApiKey: apiKey
          })
        })
      )
    })
  })

  it('reports nothing while the gate stays open', async () => {
    useCurrentUser().isLoggedIn = computed(() => true)
    state.hasPartnerNodes.value = true
    setup()
    await nextTick()

    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('does not gate while auth is still resolving, then follows the outcome', async () => {
    const loggedIn = ref(false)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    state.hasPartnerNodes.value = true
    useAuthStore().isInitialized = false
    const { gate } = setup()
    expect(gate.value, 'unresolved auth must never read as signed-out').toBe(
      'none'
    )

    loggedIn.value = true
    useAuthStore().isInitialized = true
    await nextTick()
    expect(gate.value, 'a signed-in resolution keeps the gate open').toBe(
      'none'
    )

    loggedIn.value = false
    await nextTick()
    expect(gate.value).toBe('sign-in')
  })

  it('does not gate while a stored API key validates, then follows the outcome', async () => {
    useCurrentUser().isLoggedIn = computed(() => false)
    await storeApiKeyStillValidating()
    state.hasPartnerNodes.value = true
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    const { gate } = setup()
    await nextTick()
    expect(gate.value, 'a validating key must never read as signed-out').toBe(
      'none'
    )
    expect(mockReportError).not.toHaveBeenCalled()

    await useApiKeyAuthStore().clearStoredApiKey()
    await nextTick()
    expect(gate.value, 'a rejected key leaves the user signed out').toBe(
      'sign-in'
    )
  })

  it('stays inert when the feature flag is off, even for a gated graph', async () => {
    vi.mocked(useFeatureFlags().flags).partnerRunGateEnabled = false

    state.hasPartnerNodes.value = true
    const { gate } = setup()
    expect(gate.value).toBe('none')

    vi.mocked(useFeatureFlags().flags).partnerRunGateEnabled = true
    await nextTick()
    expect(gate.value, 'flag flips back on without a reload').toBe('sign-in')
  })
})

describe('partnerRunGateBlocksAutoQueue', () => {
  beforeEach(() => {
    state.partnerNodes = ref([])
    useAuthStore().isInitialized = true
  })

  it('blocks a signed-out local graph that contains partner nodes', () => {
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    expect(partnerRunGateBlocksAutoQueue()).toBe(true)
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'partner_run_gate_blocked',
        tags: expect.objectContaining({ trigger: 'auto-queue' })
      })
    )
  })

  it('never blocks while auth is still resolving', () => {
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    useAuthStore().isInitialized = false
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('never blocks while a stored API key is still validating', async () => {
    useCurrentUser().isLoggedIn = computed(() => false)
    await storeApiKeyStillValidating()
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('never blocks while the feature flag is off', () => {
    vi.mocked(useFeatureFlags().flags).partnerRunGateEnabled = false
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('allows a signed-out graph with no partner nodes', () => {
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('allows partner nodes once the user is signed in', () => {
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    useCurrentUser().isLoggedIn = computed(() => true)
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })
})
