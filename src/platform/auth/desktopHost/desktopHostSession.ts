import { computed, shallowRef } from 'vue'

import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'

interface DesktopHostUser {
  id: string
  email?: string
  workspaceId?: string
}

/** `inactive`: Desktop does not share its session, so Firebase owns identity as before. */
type DesktopHostSession =
  | { status: 'inactive' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: DesktopHostUser }

const session = shallowRef<DesktopHostSession>({ status: 'inactive' })
let bridge: DesktopHostAuthBridge | undefined
let unsubscribe: (() => void) | undefined

function toSession(state: DesktopHostAuthState): DesktopHostSession {
  if (state.status === 'disabled') return { status: 'inactive' }
  if (state.status === 'signed_out') return { status: 'signed_out' }
  const { userId, email, workspaceId } = state
  return { status: 'signed_in', user: { id: userId, email, workspaceId } }
}

function apply(state: DesktopHostAuthState): void {
  const next = toSession(state)
  if (next.status === 'inactive') {
    stopDesktopHostSession()
    return
  }
  session.value = next
}

/** The Desktop account signed in to this view, or null. */
export const desktopHostUser = computed(() =>
  session.value.status === 'signed_in' ? session.value.user : null
)

/** True while Desktop shares its session with this view, signed in or not. */
export function isDesktopHostSessionActive(): boolean {
  return session.value.status !== 'inactive'
}

/**
 * Makes the Desktop account the identity for this page when Desktop shares
 * its session. Stays inactive, leaving Firebase in charge, when Desktop
 * answers `disabled` or the bridge fails.
 */
export async function startDesktopHostSession(
  hostBridge: DesktopHostAuthBridge
): Promise<void> {
  stopDesktopHostSession()
  bridge = hostBridge
  try {
    const initial = await hostBridge.getState()
    if (bridge !== hostBridge) return
    unsubscribe = hostBridge.onChanged(apply)
    apply(initial)
  } catch {
    stopDesktopHostSession()
  }
}

export function stopDesktopHostSession(): void {
  unsubscribe?.()
  unsubscribe = undefined
  bridge = undefined
  session.value = { status: 'inactive' }
}

/** A current access token from Desktop, which refreshes it; undefined when signed out. */
export async function desktopHostAccessToken(): Promise<string | undefined> {
  if (!bridge || session.value.status !== 'signed_in') return undefined
  return (await bridge.getAccessToken().catch(() => null)) ?? undefined
}

/** Runs Desktop's browser sign-in. Resolves true when it ends signed in. */
export async function requestDesktopHostSignIn(): Promise<boolean> {
  const current = bridge
  if (!current) return false
  const next = await current.requestSignIn().catch(() => undefined)
  if (next && bridge === current) apply(next)
  return desktopHostUser.value !== null
}
