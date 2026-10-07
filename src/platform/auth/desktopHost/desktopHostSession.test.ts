import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  desktopHostUser,
  desktopHostWorkspaceToken,
  isDesktopHostSessionActive,
  requestDesktopHostSignIn,
  requestDesktopHostSignOut,
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'

const SIGNED_IN: DesktopHostAuthState = {
  status: 'signed_in',
  userId: 'user-1',
  email: 'a@example.com',
  workspaceId: 'ws-1'
}

function fakeBridge(initial: DesktopHostAuthState) {
  const listeners = new Set<(state: DesktopHostAuthState) => void>()
  const bridge = {
    getState: vi.fn(async () => initial),
    getWorkspaceToken: vi.fn(
      async (_workspaceId: string): Promise<string | null> => 'host-token'
    ),
    requestSignIn: vi.fn(async (): Promise<DesktopHostAuthState> => SIGNED_IN),
    signOut: vi.fn(
      async (): Promise<DesktopHostAuthState> => ({ status: 'signed_out' })
    ),
    onChanged: vi.fn((callback: (state: DesktopHostAuthState) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    })
  } satisfies DesktopHostAuthBridge
  const push = (state: DesktopHostAuthState) =>
    listeners.forEach((listener) => listener(state))
  return { bridge, push, listeners }
}

afterEach(() => stopDesktopHostSession())

describe('desktopHostSession', () => {
  it('stays inactive when Desktop does not share its session', async () => {
    const { bridge, listeners } = fakeBridge({ status: 'disabled' })

    await startDesktopHostSession(bridge)

    expect(isDesktopHostSessionActive()).toBe(false)
    expect(desktopHostUser.value).toBeNull()
    expect(listeners.size).toBe(0)
  })

  it('stays inactive when the bridge fails', async () => {
    const { bridge } = fakeBridge(SIGNED_IN)
    bridge.getState.mockRejectedValue(new Error('ipc failed'))

    await startDesktopHostSession(bridge)

    expect(isDesktopHostSessionActive()).toBe(false)
  })

  it('takes the Desktop account and its access token when signed in', async () => {
    const { bridge } = fakeBridge(SIGNED_IN)

    await startDesktopHostSession(bridge)

    expect(isDesktopHostSessionActive()).toBe(true)
    expect(desktopHostUser.value).toEqual({
      id: 'user-1',
      email: 'a@example.com',
      workspaceId: 'ws-1'
    })
    await expect(desktopHostWorkspaceToken('ws-1')).resolves.toBe('host-token')
    expect(bridge.getWorkspaceToken).toHaveBeenCalledWith('ws-1')
  })

  it('is active but signed out, with no token, when Desktop has no account', async () => {
    const { bridge } = fakeBridge({ status: 'signed_out' })

    await startDesktopHostSession(bridge)

    expect(isDesktopHostSessionActive()).toBe(true)
    expect(desktopHostUser.value).toBeNull()
    await expect(desktopHostWorkspaceToken('ws-1')).resolves.toBeUndefined()
    expect(bridge.getWorkspaceToken).not.toHaveBeenCalled()
  })

  it('follows Desktop sign-out and stops when Desktop turns sharing off', async () => {
    const { bridge, push, listeners } = fakeBridge(SIGNED_IN)
    await startDesktopHostSession(bridge)

    push({ status: 'signed_out' })
    expect(desktopHostUser.value).toBeNull()
    expect(isDesktopHostSessionActive()).toBe(true)

    push({ status: 'disabled' })
    expect(isDesktopHostSessionActive()).toBe(false)
    expect(listeners.size).toBe(0)
  })

  it.for([
    { name: 'signed in', result: SIGNED_IN, expected: true },
    {
      name: 'still signed out',
      result: { status: 'signed_out' } as const,
      expected: false
    }
  ])(
    'reports whether the Desktop sign-in ended $name',
    async ({ result, expected }) => {
      const { bridge } = fakeBridge({ status: 'signed_out' })
      bridge.requestSignIn.mockResolvedValue(result)
      await startDesktopHostSession(bridge)

      await expect(requestDesktopHostSignIn()).resolves.toBe(expected)
    }
  )

  describe('when Desktop changes state while a request is pending', () => {
    function deferred<T>() {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((done) => (resolve = done))
      return { promise, resolve }
    }

    it('keeps a change that arrives while the initial state is loading', async () => {
      const { bridge, push } = fakeBridge(SIGNED_IN)
      const initial = deferred<DesktopHostAuthState>()
      bridge.getState.mockReturnValue(initial.promise)

      const starting = startDesktopHostSession(bridge)
      push({ status: 'signed_out' })
      initial.resolve(SIGNED_IN)
      await starting

      expect(isDesktopHostSessionActive()).toBe(true)
      expect(desktopHostUser.value).toBeNull()
    })

    it('drops a token fetched across a sign-out', async () => {
      const { bridge, push } = fakeBridge(SIGNED_IN)
      await startDesktopHostSession(bridge)
      const token = deferred<string | null>()
      bridge.getWorkspaceToken.mockReturnValue(token.promise)

      const fetching = desktopHostWorkspaceToken('ws-1')
      push({ status: 'signed_out' })
      token.resolve('stale-token')

      await expect(fetching).resolves.toBeUndefined()
    })

    it('ignores a sign-in result that a newer change overtook', async () => {
      const { bridge, push } = fakeBridge({ status: 'signed_out' })
      await startDesktopHostSession(bridge)
      const signIn = deferred<DesktopHostAuthState>()
      bridge.requestSignIn.mockReturnValue(signIn.promise)

      const signingIn = requestDesktopHostSignIn()
      push({ status: 'signed_out' })
      signIn.resolve(SIGNED_IN)

      await expect(signingIn).resolves.toBe(false)
      expect(desktopHostUser.value).toBeNull()
    })
  })

  it.for([
    {
      name: 'signs out',
      result: { status: 'signed_out' } as const,
      expected: true
    },
    { name: 'keeps its session', result: SIGNED_IN, expected: false }
  ])(
    'reports whether Desktop $name on sign-out',
    async ({ result, expected }) => {
      const { bridge } = fakeBridge(SIGNED_IN)
      bridge.signOut.mockResolvedValue(result)
      await startDesktopHostSession(bridge)

      await expect(requestDesktopHostSignOut()).resolves.toBe(expected)
      expect(desktopHostUser.value === null).toBe(expected)
    }
  )

  it('does not start a Desktop sign-in while inactive', async () => {
    await expect(requestDesktopHostSignIn()).resolves.toBe(false)
  })
})
