import { vi } from 'vitest'

import type {
  HostAuthBridge,
  HostAuthState
} from '@/platform/auth/host/hostAuthBridge'

export const SIGNED_IN: HostAuthState = {
  status: 'signed_in',
  userId: 'comfy-user-1',
  email: 'ada@example.com',
  workspaceId: 'ws-1'
}

export function fakeHostAuthBridge(
  initial: HostAuthState = SIGNED_IN,
  accessToken = 'host-access-token'
) {
  const listeners = new Set<(state: HostAuthState) => void>()
  const bridge = {
    getState: vi.fn(async () => initial),
    getAccessToken: vi.fn(async (): Promise<string | null> => accessToken),
    requestSignIn: vi.fn(async (): Promise<HostAuthState> => SIGNED_IN),
    reportRefusal: vi.fn(
      async (): Promise<HostAuthState> => ({ status: 'signed_out' })
    ),
    onChanged: vi.fn((callback: (state: HostAuthState) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    })
  } satisfies HostAuthBridge
  const push = (state: HostAuthState) => {
    for (const listener of listeners) listener(state)
  }
  return { bridge, push }
}
