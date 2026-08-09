import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueModule from 'vue'
import { nextTick } from 'vue'

type MockAuthStore = {
  isInitialized: boolean
  currentUser: { uid: string } | null
}

const hoisted = vi.hoisted(() => ({
  authStore: null as unknown as MockAuthStore
}))

vi.mock('@/stores/authStore', async () => {
  const { reactive } = await vi.importActual<typeof VueModule>('vue')
  hoisted.authStore = reactive<MockAuthStore>({
    isInitialized: false,
    currentUser: null
  })
  return { useAuthStore: () => hoisted.authStore }
})

import { syncHostUserIdWithFirebaseAuth } from './hostUserIdSync'

const stopHandles: Array<() => void> = []

function installTelemetryBridge() {
  const reportFirebaseAuthState = vi.fn()
  window.__comfyDesktop2 = {
    isRemote: () => false,
    Telemetry: {
      capture: vi.fn(),
      reportFirebaseAuthState
    }
  }
  return { reportFirebaseAuthState }
}

function startSync(): void {
  const stop = syncHostUserIdWithFirebaseAuth()
  if (stop) stopHandles.push(stop)
}

describe('host user ID sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.authStore.isInitialized = false
    hoisted.authStore.currentUser = null
  })

  afterEach(() => {
    while (stopHandles.length) stopHandles.pop()?.()
    delete window.__comfyDesktop2
  })

  it('waits for Firebase auth initialization before reporting a user', async () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    startSync()

    expect(reportFirebaseAuthState).toHaveBeenCalledOnce()
    expect(reportFirebaseAuthState).toHaveBeenLastCalledWith({
      status: 'pending'
    })

    hoisted.authStore.currentUser = { uid: 'firebase-user-a' }
    await nextTick()

    expect(reportFirebaseAuthState).toHaveBeenCalledOnce()

    hoisted.authStore.isInitialized = true
    await nextTick()

    expect(reportFirebaseAuthState).toHaveBeenLastCalledWith({
      status: 'signed_in',
      userId: 'firebase-user-a'
    })
  })

  it('reports a restored Firebase session immediately', () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    hoisted.authStore.currentUser = { uid: 'firebase-user-a' }
    hoisted.authStore.isInitialized = true

    startSync()

    expect(reportFirebaseAuthState.mock.calls).toEqual([
      [{ status: 'pending' }],
      [{ status: 'signed_in', userId: 'firebase-user-a' }]
    ])
  })

  it('reports an initially signed-out Firebase session', () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    hoisted.authStore.isInitialized = true

    startSync()

    expect(reportFirebaseAuthState.mock.calls).toEqual([
      [{ status: 'pending' }],
      [{ status: 'signed_out' }]
    ])
  })

  it('reports signed out when Firebase finishes initialization', async () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    startSync()

    expect(reportFirebaseAuthState).toHaveBeenCalledOnce()

    hoisted.authStore.isInitialized = true
    await nextTick()

    expect(reportFirebaseAuthState).toHaveBeenLastCalledWith({
      status: 'signed_out'
    })
  })

  it('reports account switches, logout, and subsequent login', async () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    hoisted.authStore.currentUser = { uid: 'firebase-user-a' }
    hoisted.authStore.isInitialized = true
    startSync()

    hoisted.authStore.currentUser = { uid: 'firebase-user-b' }
    await nextTick()

    expect(reportFirebaseAuthState).toHaveBeenLastCalledWith({
      status: 'signed_in',
      userId: 'firebase-user-b'
    })

    hoisted.authStore.currentUser = null
    await nextTick()

    expect(reportFirebaseAuthState).toHaveBeenLastCalledWith({
      status: 'signed_out'
    })

    hoisted.authStore.currentUser = { uid: 'firebase-user-c' }
    await nextTick()

    expect(reportFirebaseAuthState.mock.calls).toEqual([
      [{ status: 'pending' }],
      [{ status: 'signed_in', userId: 'firebase-user-a' }],
      [{ status: 'signed_in', userId: 'firebase-user-b' }],
      [{ status: 'signed_out' }],
      [{ status: 'signed_in', userId: 'firebase-user-c' }]
    ])
  })

  it('does not report again when Firebase replaces the user object with the same UID', async () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    hoisted.authStore.currentUser = { uid: 'firebase-user-a' }
    hoisted.authStore.isInitialized = true
    startSync()

    hoisted.authStore.currentUser = { uid: 'firebase-user-a' }
    await nextTick()

    expect(reportFirebaseAuthState.mock.calls).toEqual([
      [{ status: 'pending' }],
      [{ status: 'signed_in', userId: 'firebase-user-a' }]
    ])
  })

  it('does not let a host reporting failure interrupt Firebase state sync', async () => {
    const { reportFirebaseAuthState } = installTelemetryBridge()
    reportFirebaseAuthState.mockImplementationOnce(() => {
      throw new Error('host unavailable')
    })

    expect(() => startSync()).not.toThrow()

    hoisted.authStore.currentUser = { uid: 'firebase-user-a' }
    hoisted.authStore.isInitialized = true
    await nextTick()

    expect(reportFirebaseAuthState).toHaveBeenLastCalledWith({
      status: 'signed_in',
      userId: 'firebase-user-a'
    })
  })
})
