import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import * as currentUserModule from '@/composables/auth/useCurrentUser'
import * as featureFlagsModule from '@/composables/useFeatureFlags'
import * as authStoreModule from '@/stores/authStore'

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

vi.mock('@/composables/node/usePartnerNodesInGraph', async () => {
  const { computed } = await import('vue')
  return {
    usePartnerNodesInGraph: () => ({
      partnerNodes: computed(() => state.partnerNodes.value),
      hasPartnerNodes: computed(() => state.hasPartnerNodes.value)
    }),
    scanPartnerNodesInGraph: () => state.partnerNodes.value
  }
})

vi.mock('@/composables/auth/useCurrentUser', async () => {
  const { computed, ref } = await import('vue')
  const loggedIn = ref(false)
  return {
    useCurrentUser: () => ({
      isLoggedIn: computed(() => loggedIn.value)
    }),
    __setLoggedIn: (value: boolean) => {
      loggedIn.value = value
    }
  }
})

vi.mock('@/stores/authStore', async () => {
  const { ref } = await import('vue')
  const initialized = ref(true)
  return {
    useAuthStore: () => ({
      get isInitialized() {
        return initialized.value
      }
    }),
    __setAuthResolved: (value: boolean) => {
      initialized.value = value
    }
  }
})

vi.mock('@/composables/useFeatureFlags', async () => {
  const { reactive } = await import('vue')
  const flags = reactive({ partnerRunGateEnabled: true })
  return {
    useFeatureFlags: () => ({ flags }),
    __setPartnerRunGateEnabled: (value: boolean) => {
      flags.partnerRunGateEnabled = value
    }
  }
})

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

const { __setLoggedIn } = currentUserModule as typeof currentUserModule & {
  __setLoggedIn: (value: boolean) => void
}
const { __setAuthResolved } = authStoreModule as typeof authStoreModule & {
  __setAuthResolved: (value: boolean) => void
}
const { __setPartnerRunGateEnabled } =
  featureFlagsModule as typeof featureFlagsModule & {
    __setPartnerRunGateEnabled: (value: boolean) => void
  }

let scope: EffectScope

function setup() {
  scope = effectScope()
  return scope.run(() => usePartnerNodesRunGate())!
}

describe('usePartnerNodesRunGate', () => {
  beforeEach(() => {
    state.hasPartnerNodes = ref(false)
    state.partnerNodes = ref([])
    __setLoggedIn(false)
    __setAuthResolved(true)
    __setPartnerRunGateEnabled(true)
  })

  afterEach(() => {
    scope.stop()
  })

  it('resolves none without partner nodes', () => {
    __setLoggedIn(true)
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
    __setLoggedIn(true)
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
    __setLoggedIn(true)
    const { gate } = setup()
    expect(gate.value).toBe('none')

    __setLoggedIn(false)
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
          isLoggedIn: false,
          partnerNodeCount: 1
        }),
        context: { partnerNodeTypes: ['Kling'] }
      })
    )
  })

  it('reports nothing while the gate stays open', async () => {
    __setLoggedIn(true)
    state.hasPartnerNodes.value = true
    setup()
    await nextTick()

    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('does not gate while auth is still resolving, then follows the outcome', async () => {
    state.hasPartnerNodes.value = true
    __setAuthResolved(false)
    const { gate } = setup()
    expect(gate.value, 'unresolved auth must never read as signed-out').toBe(
      'none'
    )

    __setLoggedIn(true)
    __setAuthResolved(true)
    await nextTick()
    expect(gate.value, 'a signed-in resolution keeps the gate open').toBe(
      'none'
    )

    __setLoggedIn(false)
    await nextTick()
    expect(gate.value).toBe('sign-in')
  })

  it('stays inert when the feature flag is off, even for a gated graph', async () => {
    state.hasPartnerNodes.value = true
    __setPartnerRunGateEnabled(false)
    const { gate } = setup()
    expect(gate.value).toBe('none')

    __setPartnerRunGateEnabled(true)
    await nextTick()
    expect(gate.value, 'flag flips back on without a reload').toBe('sign-in')
  })
})

describe('partnerRunGateBlocksAutoQueue', () => {
  beforeEach(() => {
    state.partnerNodes = ref([])
    __setLoggedIn(false)
    __setAuthResolved(true)
    __setPartnerRunGateEnabled(true)
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
    __setAuthResolved(false)
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('never blocks while the feature flag is off', () => {
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    __setPartnerRunGateEnabled(false)
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('allows a signed-out graph with no partner nodes', () => {
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })

  it('allows partner nodes once the user is signed in', () => {
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    __setLoggedIn(true)
    expect(partnerRunGateBlocksAutoQueue()).toBe(false)
  })
})
