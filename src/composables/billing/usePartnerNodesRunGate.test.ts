import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import * as currentUserModule from '@/composables/auth/useCurrentUser'

import { usePartnerNodesRunGate } from './usePartnerNodesRunGate'

const state = vi.hoisted(() => ({
  hasPartnerNodes: false,
  partnerNodes: [] as { nodeName: string; displayName: string }[]
}))

vi.mock('@/composables/node/usePartnerNodesInGraph', async () => {
  const { computed } = await import('vue')
  return {
    usePartnerNodesInGraph: () => ({
      partnerNodes: computed(() => state.partnerNodes),
      hasPartnerNodes: computed(() => state.hasPartnerNodes)
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
    state.hasPartnerNodes = false
    state.partnerNodes = []
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
    state.hasPartnerNodes = true
    const { gate } = setup()
    expect(gate.value).toBe('sign-in')
  })

  it('resolves none when signed in', () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    const { gate } = setup()
    expect(gate.value).toBe('none')
  })

  it('flips to sign-in when the user signs out mid-session', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    const { gate } = setup()
    expect(gate.value).toBe('none')

    __setLoggedIn(false)
    await nextTick()
    expect(gate.value).toBe('sign-in')
  })
})
