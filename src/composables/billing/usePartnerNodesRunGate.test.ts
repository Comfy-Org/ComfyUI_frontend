import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import * as authStoreModule from '@/stores/authStore'
import * as currentUserModule from '@/composables/auth/useCurrentUser'

import { usePartnerNodesRunGate } from './usePartnerNodesRunGate'

const state = vi.hoisted(() => ({
  hasPartnerNodes: false,
  partnerNodes: [] as { nodeName: string; displayName: string }[]
}))

const mockFetchBalance = vi.hoisted(() =>
  vi.fn<() => Promise<{ amount_micros?: number } | null>>(() =>
    Promise.resolve(null)
  )
)

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
  const userId = ref<string | null>(null)
  return {
    useCurrentUser: () => ({
      isLoggedIn: computed(() => loggedIn.value),
      resolvedUserInfo: computed(() =>
        userId.value ? { id: userId.value } : null
      )
    }),
    __setLoggedIn: (value: boolean) => {
      loggedIn.value = value
    },
    __setUserId: (value: string | null) => {
      userId.value = value
    }
  }
})

vi.mock('@/stores/authStore', async () => {
  const { ref } = await import('vue')
  const balance = ref<{ amount_micros?: number } | null>(null)
  return {
    useAuthStore: () => ({
      get balance() {
        return balance.value
      },
      fetchBalance: mockFetchBalance
    }),
    __setBalance: (value: { amount_micros?: number } | null) => {
      balance.value = value
    }
  }
})

const { __setLoggedIn, __setUserId } =
  currentUserModule as typeof currentUserModule & {
    __setLoggedIn: (value: boolean) => void
    __setUserId: (value: string | null) => void
  }
const { __setBalance } = authStoreModule as typeof authStoreModule & {
  __setBalance: (value: { amount_micros?: number } | null) => void
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
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
    __setUserId(null)
    __setBalance(null)
    mockFetchBalance.mockReset()
    mockFetchBalance.mockImplementation(() => Promise.resolve(null))
  })

  afterEach(() => {
    scope.stop()
  })

  it('resolves none without partner nodes and never fetches balance', async () => {
    __setLoggedIn(true)
    const { gate } = setup()
    await flushPromises()

    expect(gate.value).toBe('none')
    expect(mockFetchBalance).not.toHaveBeenCalled()
  })

  it('gates on sign-in when signed out, without fetching balance', () => {
    state.hasPartnerNodes = true
    const { gate } = setup()

    expect(gate.value).toBe('sign-in')
    expect(mockFetchBalance).not.toHaveBeenCalled()
  })

  it('gates on add-credits when the probe finds a zero balance', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    mockFetchBalance.mockResolvedValue({ amount_micros: 0 })

    const { gate } = setup()
    await flushPromises()

    expect(gate.value).toBe('add-credits')
  })

  it('treats the 404 new-customer null as no credits', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    mockFetchBalance.mockResolvedValue(null)

    const { gate } = setup()
    await flushPromises()

    expect(gate.value).toBe('add-credits')
  })

  it('fails open while the probe is pending and when it errors', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    let rejectProbe!: (reason: Error) => void
    mockFetchBalance.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectProbe = reject
        })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { gate } = setup()
    expect(gate.value).toBe('none')

    rejectProbe(new Error('offline'))
    await flushPromises()
    expect(gate.value).toBe('none')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('retries a failed probe on window focus', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    mockFetchBalance.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { gate } = setup()
    await flushPromises()
    expect(gate.value).toBe('none')

    mockFetchBalance.mockResolvedValue({ amount_micros: 0 })
    window.dispatchEvent(new Event('focus'))
    await flushPromises()

    expect(gate.value).toBe('add-credits')
  })

  it('resolves none when the probe finds funds', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    mockFetchBalance.mockResolvedValue({ amount_micros: 5_000_000 })

    const { gate } = setup()
    await flushPromises()

    expect(gate.value).toBe('none')
  })

  it('prefers the live store balance over the probe result', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    mockFetchBalance.mockResolvedValue(null)

    const { gate } = setup()
    await flushPromises()
    expect(gate.value).toBe('add-credits')

    __setBalance({ amount_micros: 2_000_000 })
    await nextTick()
    expect(gate.value).toBe('none')

    __setBalance({ amount_micros: 0 })
    await nextTick()
    expect(gate.value).toBe('add-credits')
  })

  it('discards a stale probe that resolves after an account switch', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    __setUserId('user-a')
    let resolveStaleProbe!: (value: null) => void
    mockFetchBalance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStaleProbe = resolve
        })
    )

    const { gate } = setup()
    expect(gate.value).toBe('none')

    mockFetchBalance.mockResolvedValue({ amount_micros: 5_000_000 })
    __setUserId('user-b')
    await nextTick()
    await flushPromises()
    expect(gate.value).toBe('none')

    resolveStaleProbe(null)
    await flushPromises()
    expect(gate.value).toBe('none')
  })

  it('flips to sign-in when the user signs out mid-session', async () => {
    state.hasPartnerNodes = true
    __setLoggedIn(true)
    mockFetchBalance.mockResolvedValue({ amount_micros: 0 })

    const { gate } = setup()
    await flushPromises()
    expect(gate.value).toBe('add-credits')

    __setLoggedIn(false)
    await nextTick()
    expect(gate.value).toBe('sign-in')
  })
})
