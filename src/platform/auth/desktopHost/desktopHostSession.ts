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
/** Bumped on every session change, so a reply that raced one is dropped. */
let revision = 0

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
  revision++
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
    unsubscribe = hostBridge.onChanged(apply)
    const before = revision
    const initial = await hostBridge.getState()
    if (bridge === hostBridge && revision === before) apply(initial)
  } catch {
    if (bridge === hostBridge) stopDesktopHostSession()
  }
}

export function stopDesktopHostSession(): void {
  unsubscribe?.()
  unsubscribe = undefined
  bridge = undefined
  revision++
  session.value = { status: 'inactive' }
}

/**
 * Desktop's credential for `workspaceId`, released only when its session is
 * scoped to exactly that workspace. This is the API-node credential.
 */
export function desktopHostWorkspaceToken(
  workspaceId: string
): Promise<string | undefined> {
  return fetchToken((current) => current.getWorkspaceToken(workspaceId))
}

/** Desktop's account token for user-identity calls that name no workspace. */
export function desktopHostIdentityToken(): Promise<string | undefined> {
  return fetchToken((current) => current.getIdentityToken())
}

async function fetchToken(
  read: (current: DesktopHostAuthBridge) => Promise<string | null>
): Promise<string | undefined> {
  const current = bridge
  if (!current || session.value.status !== 'signed_in') return undefined
  const before = revision
  const token = await read(current).catch(() => null)
  return revision === before ? (token ?? undefined) : undefined
}

/** Runs Desktop's browser sign-in. Resolves true when it ends signed in. */
export async function requestDesktopHostSignIn(): Promise<boolean> {
  const current = bridge
  if (!current) return false
  const before = revision
  const next = await current.requestSignIn().catch(() => undefined)
  if (next && bridge === current && revision === before) apply(next)
  return desktopHostUser.value !== null
}

/** Signs Desktop out of its account. Resolves true once no Desktop user remains. */
export async function requestDesktopHostSignOut(): Promise<boolean> {
  const current = bridge
  if (!current) return true
  const before = revision
  const next = await current.signOut().catch(() => undefined)
  if (next && bridge === current && revision === before) apply(next)
  return desktopHostUser.value === null
}
