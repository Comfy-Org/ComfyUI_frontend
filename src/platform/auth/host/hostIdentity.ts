import { readonly, shallowRef } from 'vue'

import type {
  HostAuthBridge,
  HostAuthRefusal,
  HostAuthState
} from '@/platform/auth/host/hostAuthBridge'

export interface HostUser {
  id: string
  email?: string
  emailVerified?: boolean
  workspaceId?: string
}

/** `inactive` means Firebase owns identity for this page load. */
type HostIdentityState =
  | { status: 'inactive' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: HostUser }

const state = shallowRef<HostIdentityState>({ status: 'inactive' })
let bridge: HostAuthBridge | undefined
let lastIssuedToken: string | undefined
let unsubscribe: (() => void) | undefined

export const hostIdentityState = readonly(state)

function toIdentityState(host: HostAuthState): HostIdentityState {
  if (host.status === 'disabled') return { status: 'inactive' }
  if (host.status === 'signed_out') return { status: 'signed_out' }
  const { status: _status, userId, ...rest } = host
  return { status: 'signed_in', user: { id: userId, ...rest } }
}

function apply(host: HostAuthState): void {
  if (!bridge) return
  const next = toIdentityState(host)
  if (next.status === 'inactive') {
    stopHostIdentity()
    return
  }
  if (next.status === 'signed_out') lastIssuedToken = undefined
  state.value = next
}

/**
 * Makes the Desktop host's account the identity for this page load when the
 * host hands one over. Stays inactive, leaving Firebase in charge, when the
 * host reports `disabled` or the bridge fails.
 */
export async function startHostIdentity(
  hostBridge: HostAuthBridge
): Promise<void> {
  stopHostIdentity()
  bridge = hostBridge
  try {
    const initial = await hostBridge.getState()
    if (bridge !== hostBridge) return
    unsubscribe = hostBridge.onChanged(apply)
    apply(initial)
  } catch {
    stopHostIdentity()
  }
}

export function stopHostIdentity(): void {
  unsubscribe?.()
  unsubscribe = undefined
  bridge = undefined
  lastIssuedToken = undefined
  state.value = { status: 'inactive' }
}

export function isHostIdentityActive(): boolean {
  return state.value.status !== 'inactive'
}

export function hostUser(): HostUser | null {
  return state.value.status === 'signed_in' ? state.value.user : null
}

export async function hostAccessToken(): Promise<string | undefined> {
  if (!bridge || state.value.status !== 'signed_in') return undefined
  const token = (await bridge.getAccessToken().catch(() => null)) ?? undefined
  lastIssuedToken = token
  return token
}

export async function requestHostSignIn(): Promise<void> {
  const current = bridge
  if (!current) return
  const next = await current.requestSignIn()
  if (bridge === current) apply(next)
}

/** 401, or a 403 whose body names `sso_required`. Other refusals are not about the credential. */
export function hostRefusalReason(
  status: number,
  body: string
): HostAuthRefusal | undefined {
  if (status === 401) return 'unauthorized'
  if (status === 403 && body.includes('sso_required')) return 'sso_required'
  return undefined
}

/**
 * Lets the host re-mint or sign out when a request made on its token was
 * refused. The host signs every view out when the grant is gone.
 */
export async function reportHostRefusal(response: Response): Promise<void> {
  const current = bridge
  const token = lastIssuedToken
  if (!current || !token || state.value.status !== 'signed_in') return
  if (response.status !== 401 && response.status !== 403) return
  const body = await response
    .clone()
    .text()
    .catch(() => '')
  const reason = hostRefusalReason(response.status, body)
  if (!reason) return
  const next = await current
    .reportRefusal(token, reason)
    .catch((): HostAuthState | undefined => undefined)
  if (next && bridge === current) apply(next)
}
