import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import * as currentUserModule from '@/composables/auth/useCurrentUser'

import { usePartnerNodesRunGate } from './usePartnerNodesRunGate'

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
    })
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

const { __setLoggedIn } = currentUserModule as typeof currentUserModule & {
  __setLoggedIn: (value: boolean) => void
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
})
