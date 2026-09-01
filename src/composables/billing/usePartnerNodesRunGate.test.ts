import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import * as currentUserModule from '@/composables/auth/useCurrentUser'
import * as featureFlagsModule from '@/composables/useFeatureFlags'

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

const { __setLoggedIn } = currentUserModule as typeof currentUserModule & {
  __setLoggedIn: (value: boolean) => void
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
    __setPartnerRunGateEnabled(true)
  })

  it('blocks a signed-out local graph that contains partner nodes', () => {
    state.partnerNodes.value = [{ nodeName: 'Kling', displayName: 'Kling' }]
    expect(partnerRunGateBlocksAutoQueue()).toBe(true)
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
