import { computed, shallowRef } from 'vue'

import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'

interface DesktopHostUser {
  id: string
  email?: string
  name?: string
  workspaceId?: string
}

/** `inactive`: Desktop does not share its session, so Firebase owns identity as before. */
type DesktopHostSession =
  | { status: 'inactive' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: DesktopHostUser }

const session = shallowRef<DesktopHostSession>({ status: 'inactive' })
let bridge: DesktopHostAuthBridge | undefined
let bridgeReportsSignInFailures = false
let unsubscribe: (() => void) | undefined
/** Bumped on every session change, so a reply that raced one is dropped. */
let revision = 0

function toSession(state: DesktopHostAuthState): DesktopHostSession {
  if (state.status === 'disabled') return { status: 'inactive' }
  if (state.status === 'signed_out') return { status: 'signed_out' }
  const { userId, email, name, workspaceId } = state
  return { status: 'signed_in', user: { id: userId, email, name, workspaceId } }
}

function apply(state: DesktopHostAuthState): void {
  const next = toSession(state)
  if (next.status === 'inactive') {
    stopDesktopHostSession()
    return
  }
  const current = session.value
  const sameAccount =
    next.status === 'signed_in' &&
    current.status === 'signed_in' &&
    next.user.id === current.user.id &&
    next.user.workspaceId === current.user.workspaceId
  if (!sameAccount) revision++
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

/** True while a Desktop account is signed in; only then does it own auth. */
export function isDesktopHostSignedIn(): boolean {
  return desktopHostUser.value !== null
}

/**
 * Makes the Desktop account the identity for this page when Desktop shares
 * its session. Stays inactive, leaving Firebase in charge, when Desktop
 * answers `disabled` or the bridge fails.
 */
export async function startDesktopHostSession(
  hostBridge: DesktopHostAuthBridge,
  { reportsSignInFailures = false }: { reportsSignInFailures?: boolean } = {}
): Promise<void> {
  stopDesktopHostSession()
  bridge = hostBridge
  bridgeReportsSignInFailures = reportsSignInFailures
  try {
    unsubscribe = hostBridge.onChanged(apply)
    const before = revision
    const initial = await hostBridge.getState()
    if (bridge === hostBridge && revision === before) apply(initial)
  } catch {
    if (bridge === hostBridge) stopDesktopHostSession()
  }
}

/** True when the session tells the person itself why a sign-in did not finish. */
export function desktopHostReportsSignInFailures(): boolean {
  return bridgeReportsSignInFailures
}

export function stopDesktopHostSession(): void {
  unsubscribe?.()
  bridgeReportsSignInFailures = false
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

/** True when this Desktop can re-scope its session to another workspace. */
export function canDesktopHostSwitchWorkspace(): boolean {
  return isDesktopHostSignedIn() && bridge?.switchWorkspace !== undefined
}

/**
 * Asks Desktop to re-scope its session to `workspaceId`, which may run browser
 * consent. Resolves true once the session is on that workspace.
 */
export async function requestDesktopHostWorkspaceSwitch(
  workspaceId: string
): Promise<boolean> {
  const current = bridge
  if (!current?.switchWorkspace || !isDesktopHostSignedIn()) return false
  const before = revision
  const next = await current.switchWorkspace(workspaceId).catch(() => undefined)
  if (next && bridge === current && revision === before) apply(next)
  return desktopHostUser.value?.workspaceId === workspaceId
}
