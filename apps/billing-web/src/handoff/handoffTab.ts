import { shallowRef, watch } from 'vue'

import type { BillingOperationPointer } from '@comfyorg/account-core/billing'
import { createOperationPointerStore } from '@comfyorg/account-core/billing'

import { HANDOFF_STORAGE_KEY } from '@/handoff/captureHandoffToken'
import type {
  BillingHandoffExchangeResponse,
  WorkspaceSummary
} from '@comfyorg/ingest-types'
import {
  zBillingHandoffExchangeResponse,
  zWorkspaceSummary
} from '@comfyorg/ingest-types/zod'

export const HANDOFF_PATH = '/handoff'

export function isHandoffPath(path: string): boolean {
  return /^\/handoff\/?$/.test(path)
}

const STORAGE_KEY = HANDOFF_STORAGE_KEY

export type HandoffEnding =
  | 'link_unavailable'
  | 'exchange_lost'
  | 'storage_unavailable'
  | 'refused'
  | 'payment_pending'
  | 'completed'
  | 'unconfirmed'

const zHandoffExchange = zBillingHandoffExchangeResponse.extend({
  workspace: zWorkspaceSummary
})

export interface HandoffSession {
  readonly token: string
  readonly expiresAt: number
  readonly userId: string
  readonly email: string
  readonly workspace: WorkspaceSummary
  readonly role: BillingHandoffExchangeResponse['role']
}

export type HandoffState =
  | {
      readonly kind: 'session'
      readonly session: HandoffSession
      /** Set before the first request that can start a charge leaves this tab; never unset. */
      readonly chargeAttempted?: true
    }
  | {
      readonly kind: 'ended'
      readonly ending: Exclude<HandoffEnding, 'completed'>
      /** The operation still settling when a `payment_pending` session ended. */
      readonly reference?: string
    }
  | {
      readonly kind: 'ended'
      readonly ending: 'completed'
      /** The workspace the payment was for. */
      readonly workspace: string
      /** The operation that succeeded. */
      readonly reference?: string
    }

export type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const ENDINGS: readonly HandoffEnding[] = [
  'link_unavailable',
  'exchange_lost',
  'storage_unavailable',
  'refused',
  'payment_pending',
  'completed',
  'unconfirmed'
]

const UNCONFIRMED: HandoffState = { kind: 'ended', ending: 'unconfirmed' }

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

export function readTabMarker(
  marker: TabMarker
): HandoffEnding | 'live' | undefined {
  const value = marker.read()
  if (!value.startsWith(MARKER_PREFIX)) return undefined
  const rest = value.slice(MARKER_PREFIX.length)
  if (rest === 'live') return 'live'
  return ENDINGS.find((e) => e === rest) ?? 'unconfirmed'
}

export function writeTabMarker(marker: TabMarker, state: HandoffState): void {
  marker.write(
    MARKER_PREFIX + (state.kind === 'session' ? 'live' : state.ending)
  )
}

function endedFrom(stored: Record<string, unknown>): HandoffState {
  const ending = ENDINGS.find((e) => e === stored.ending)
  const reference =
    typeof stored.reference === 'string' ? stored.reference : undefined
  if (ending === 'completed')
    return typeof stored.workspace === 'string'
      ? { kind: 'ended', ending, workspace: stored.workspace, reference }
      : UNCONFIRMED
  return ending ? { kind: 'ended', ending, reference } : UNCONFIRMED
}

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
    if (parsed.kind === 'ended') return endedFrom(parsed)
    const session =
      parsed.kind === 'session'
        ? handoffSessionFrom(parsed.exchange)
        : undefined
    if (!session) return undefined
    return parsed.chargeAttempted === undefined
      ? { kind: 'session', session }
      : { kind: 'session', session, chargeAttempted: true }
  } catch {
    return undefined
  }
}

export function writeHandoffState(
  storage: TabStorage,
  state: HandoffState
): boolean {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        state.kind === 'session'
          ? {
              kind: 'session',
              exchange: exchangeOf(state.session),
              chargeAttempted: state.chargeAttempted
            }
          : state
      )
    )
    return true
  } catch {
    return false
  }
}

export const handoffTab = shallowRef<HandoffState>()

function forgetHandoffState(storage: TabStorage): void {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

/** Records, before the request leaves, that this session sent one that can start a charge. */
export function noteChargeAttempt(storage: TabStorage): void {
  const current = handoffTab.value
  if (current?.kind !== 'session' || current.chargeAttempted) return
  const attempted: HandoffState = { ...current, chargeAttempted: true }
  if (!writeHandoffState(storage, attempted)) forgetHandoffState(storage)
  handoffTab.value = attempted
}

function storageHoldsSession(storage: TabStorage): boolean {
  const stored = readHandoffState(storage)
  return typeof stored === 'object' && stored.kind === 'session'
}

function endingFrom(trace: {
  readonly pointer: BillingOperationPointer | undefined
  readonly chargeAttempted: boolean
  readonly storageHoldsSession: boolean
  readonly workspace: string
}): HandoffState {
  const { workspace } = trace
  const payment = trace.pointer?.kind === 'cancel' ? undefined : trace.pointer
  if (payment) {
    const reference = payment.operationId
    return payment.settled === 'succeeded'
      ? { kind: 'ended', ending: 'completed', workspace, reference }
      : { kind: 'ended', ending: 'payment_pending', reference }
  }
  const unused = trace.storageHoldsSession && !trace.chargeAttempted
  return unused ? { kind: 'ended', ending: 'link_unavailable' } : UNCONFIRMED
}

/**
 * How a live session ends: on the payment its pointer records, else
 * `link_unavailable` only when the tab can prove it never sent a charge.
 */
export function sessionEnding(
  storage: TabStorage,
  live: Extract<HandoffState, { kind: 'session' }>,
  now: () => number
): HandoffState {
  const { session } = live
  return endingFrom({
    storageHoldsSession: storageHoldsSession(storage),
    chargeAttempted: live.chargeAttempted === true,
    workspace: session.workspace.name,
    pointer: createOperationPointerStore(storage, now).read({
      userId: session.userId,
      workspaceId: session.workspace.id,
      role: session.role
    })
  })
}

export function endHandoffSession(
  storage: TabStorage,
  now: () => number = () => Date.now(),
  marker: TabMarker = windowNameMarker
): void {
  const current = handoffTab.value
  if (current?.kind !== 'session') return
  const state = sessionEnding(storage, current, now)
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

export const sessionTabStorage: TabStorage = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, value),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key)
}

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
