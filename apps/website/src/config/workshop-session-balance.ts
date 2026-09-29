/**
 * The header's balance on the shared web session: the cookie authorizes the
 * read, so no workspace token is minted or held. There is no workspace
 * picker on the session header, so the read is the personal workspace's.
 * A refusal only hides the balance; the session header owns sign-out.
 */
import type { Ref } from 'vue'
import { effectScope, readonly, shallowRef, watch } from 'vue'

import { createRequestAuthorizer } from '@comfyorg/account-core/requestAuth'
import type { WebSession } from '@comfyorg/account-core/webSession'
import { zBillingBalanceResponse } from '@comfyorg/ingest-types/zod'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { createTimeoutSignal } from '../utils/abortSignal'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

export type SessionBalanceState =
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly credits: number }
  | { readonly status: 'unavailable' }
  | { readonly status: 'session_ended' }

export const SESSION_BALANCE_URL = `${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`

const BALANCE_TIMEOUT_MS = 15_000

function readBalanceCents(body: unknown): number | undefined {
  const parsed = zBillingBalanceResponse.safeParse(body)
  if (!parsed.success) return undefined
  const cents =
    parsed.data.effective_balance_micros ?? parsed.data.amount_micros
  return Number.isFinite(cents) ? cents : undefined
}

const authorize = createRequestAuthorizer({
  getWorkspaceToken: () =>
    Promise.reject(new Error('The session balance never mints a token'))
})

export async function readSessionBalance(
  session: WebSession,
  fetchImpl: typeof fetch
): Promise<SessionBalanceState> {
  const { headers, credentials } = await authorize(
    { kind: 'session', session },
    { target: 'ingest', method: 'GET' }
  )
  let response: Response
  try {
    response = await fetchImpl(SESSION_BALANCE_URL, {
      headers,
      credentials,
      signal: createTimeoutSignal(BALANCE_TIMEOUT_MS)
    })
  } catch {
    return { status: 'unavailable' }
  }
  if (response.status === 401) return { status: 'session_ended' }
  if (!response.ok) return { status: 'unavailable' }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { status: 'unavailable' }
  }
  const cents = readBalanceCents(body)
  return cents === undefined
    ? { status: 'unavailable' }
    : { status: 'ok', credits: centsToCredits(cents) }
}

interface Generation {
  readonly account: string | undefined
}

const balance = shallowRef<SessionBalanceState>({ status: 'unknown' })
let generation: Generation = { account: undefined }
let inFlight:
  | { readonly generation: Generation; readonly read: Promise<void> }
  | undefined

function refresh(session: WebSession): Promise<void> {
  if (balance.value.status === 'session_ended') return Promise.resolve()
  const owner = generation
  if (inFlight?.generation === owner) return inFlight.read
  const read = readSessionBalance(session, (...args) =>
    globalThis.fetch(...args)
  )
    .then((next) => {
      if (generation === owner) balance.value = next
    })
    .finally(() => {
      if (inFlight?.read === read) inFlight = undefined
    })
  inFlight = { generation: owner, read }
  return read
}

function follow(session: WebSession | undefined) {
  if (session?.user.id === generation.account) return
  generation = { account: session?.user.id }
  balance.value = { status: 'unknown' }
  if (session) void refresh(session)
}

let started = false

/** Reads per signed-in account, again on refocus, never after a 401. */
export function useWorkshopSessionBalance(
  session: Readonly<Ref<WebSession | undefined>>
): Readonly<Ref<SessionBalanceState>> {
  if (!started && typeof window !== 'undefined') {
    started = true
    effectScope(true).run(() => {
      watch(session, follow, { immediate: true })
    })
    window.addEventListener('focus', () => {
      if (session.value) void refresh(session.value)
    })
  }
  return readonly(balance)
}
