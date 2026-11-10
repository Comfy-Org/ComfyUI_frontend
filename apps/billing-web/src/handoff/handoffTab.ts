import { shallowRef, watch } from 'vue'

import { createOperationPointerStore } from '@comfyorg/account-core/billing'

import { HANDOFF_STORAGE_KEY } from '@/handoff/captureHandoffToken'
import type {
  ExchangeTokenResponse,
  WorkspaceSummary
} from '@comfyorg/ingest-types'
import {
  zBillingHandoffExchangeResponse,
  zExchangeTokenResponse,
  zWorkspaceSummary
} from '@comfyorg/ingest-types/zod'

/** The receiver route a billing handoff entry URL opens. */
export const HANDOFF_PATH = '/handoff'

/** `/handoff` with or without a trailing slash. */
export function isHandoffPath(path: string): boolean {
  return /^\/handoff\/?$/.test(path)
}

const STORAGE_KEY = HANDOFF_STORAGE_KEY

export type HandoffEnding =
  | 'link_unavailable'
  | 'exchange_lost'
  | 'storage_unavailable'
  | 'refused'
  | 'session_ended'
  | 'payment_pending'

const zHandoffExchange = zBillingHandoffExchangeResponse.extend({
  workspace: zWorkspaceSummary,
  role: zExchangeTokenResponse.shape.role
})

export interface HandoffSession {
  readonly token: string
  readonly expiresAt: number
  readonly userId: string
  readonly email: string
  readonly workspace: WorkspaceSummary
  readonly role: ExchangeTokenResponse['role']
}

export type HandoffState =
  | { readonly kind: 'session'; readonly session: HandoffSession }
  | {
      readonly kind: 'ended'
      readonly ending: HandoffEnding
      /** The operation still settling when a `payment_pending` session ended. */
      readonly reference?: string
    }

export type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const ENDINGS: readonly HandoffEnding[] = [
  'link_unavailable',
  'exchange_lost',
  'storage_unavailable',
  'refused',
  'session_ended',
  'payment_pending'
]

/** Reads an exchange answer, as received or as stored; anything else is no session. */
export function handoffSessionFrom(body: unknown): HandoffSession | undefined {
  const parsed = zHandoffExchange.safeParse(body)
  if (!parsed.success) return undefined
  const { session_token, expires_at, user, workspace, role } = parsed.data
  return {
    token: session_token,
    expiresAt: Date.parse(expires_at),
    userId: user.id,
    email: user.email,
    workspace,
    role
  }
}

function exchangeOf(session: HandoffSession) {
  return {
    session_token: session.token,
    expires_at: new Date(session.expiresAt).toISOString(),
    user: { id: session.userId, email: session.email },
    workspace: session.workspace,
    role: session.role
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** A tab-scoped record that the tab holds a handoff, kept outside storage so a blocked storage cannot hide it. */
export interface TabMarker {
  readonly read: () => string
  readonly write: (value: string) => void
}

const MARKER_PREFIX = 'comfy-billing-handoff:'

export const windowNameMarker: TabMarker = {
  read: () => window.name,
  write: (value) => {
    window.name = value
  }
}

/** `live` while a session may still be in use, else how the handoff ended. */
export function readTabMarker(
  marker: TabMarker
): HandoffEnding | 'live' | undefined {
  const value = marker.read()
  if (!value.startsWith(MARKER_PREFIX)) return undefined
  const rest = value.slice(MARKER_PREFIX.length)
  return rest === 'live' ? 'live' : ENDINGS.find((e) => e === rest)
}

export function writeTabMarker(marker: TabMarker, state: HandoffState): void {
  marker.write(
    MARKER_PREFIX + (state.kind === 'session' ? 'live' : state.ending)
  )
}

/** Reads a stored state; `unreadable` when the storage itself refused the read. */
export function readHandoffState(
  storage: TabStorage
): HandoffState | 'unreadable' | undefined {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return 'unreadable'
  }
  try {
    if (raw === null) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return undefined
    if (parsed.kind === 'ended') {
      const ending = ENDINGS.find((e) => e === parsed.ending)
      const reference =
        typeof parsed.reference === 'string' ? parsed.reference : undefined
      return ending && { kind: 'ended', ending, reference }
    }
    const session =
      parsed.kind === 'session'
        ? handoffSessionFrom(parsed.exchange)
        : undefined
    return session && { kind: 'session', session }
  } catch {
    return undefined
  }
}

/** False when the tab's storage refused the write. */
export function writeHandoffState(
  storage: TabStorage,
  state: HandoffState
): boolean {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        state.kind === 'session'
          ? { kind: 'session', exchange: exchangeOf(state.session) }
          : state
      )
    )
    return true
  } catch {
    return false
  }
}

/**
 * This tab's handoff, set by the bootstrap before the app loads. Undefined
 * means the tab is not a handoff tab and billing-web runs its own sign-in.
 */
export const handoffTab = shallowRef<HandoffState>()

/** How a session ends: on a payment this tab started and has not seen succeed, or plainly. */
export function sessionEnding(
  storage: TabStorage,
  session: HandoffSession,
  now: () => number
): HandoffState {
  const pointer = createOperationPointerStore(storage, now).read({
    userId: session.userId,
    workspaceId: session.workspace.id,
    role: session.role
  })
  return pointer && pointer.kind !== 'cancel' && pointer.settled !== 'succeeded'
    ? {
        kind: 'ended',
        ending: 'payment_pending',
        reference: pointer.operationId
      }
    : { kind: 'ended', ending: 'session_ended' }
}

/** Ends the tab's session; the ending survives a reload, through the tab marker when storage refuses it. */
export function endHandoffSession(
  storage: TabStorage,
  now: () => number = () => Date.now(),
  marker: TabMarker = windowNameMarker
): void {
  const current = handoffTab.value
  if (current?.kind !== 'session') return
  const state = sessionEnding(storage, current.session, now)
  writeHandoffState(storage, state)
  writeTabMarker(marker, state)
  handoffTab.value = state
}

export function liveHandoffSession(now: number): HandoffSession | undefined {
  const state = handoffTab.value
  return state?.kind === 'session' && state.session.expiresAt > now
    ? state.session
    : undefined
}

/** Tab storage that reports a blocked `sessionStorage` as failed calls instead of throwing on access. */
export const sessionTabStorage: TabStorage = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, value),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key)
}

/** Ends the tab's handoff when its session expires, even while nothing calls billing. */
export function endHandoffAtExpiry(
  storage: TabStorage,
  now: () => number = () => Date.now()
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = watch(
    handoffTab,
    (state) => {
      clearTimeout(timer)
      if (state?.kind !== 'session') return
      timer = setTimeout(
        () => endHandoffSession(storage, now),
        Math.max(0, state.session.expiresAt - now())
      )
    },
    { immediate: true }
  )
  return () => {
    stop()
    clearTimeout(timer)
  }
}
