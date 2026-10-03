/**
 * The credits balance behind the header chip.
 *
 * The authorized read (dedupe, the single 401 re-mint, superseded-identity
 * publish guards) lives in the site's own balance reader, since billing
 * stays outside @comfyorg/account-core in V1; this module owns presentation and
 * page lifecycle. Conversion goes through the shared
 * creditsUtil rounding so this chip never disagrees with what
 * platform.comfy.org renders for the same balance. Refresh triggers: the
 * session appearing or changing (sign-in, re-mint), window refocus,
 * which also picks up a balance changed in another tab, and a finished run
 * marking the credits dirty.
 */
import { computed, effectScope, ref, watch } from 'vue'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { workshopBalanceReader } from './workshop-account'
import type { BalanceState as ReadState } from './workshop-balance'
import { useWorkshopSession } from './workshop-session-state'

/** Despite the field names, the balance endpoint returns cents. */
export function balanceToCredits(cents: number): number {
  return centsToCredits(cents)
}

type BalanceState =
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly credits: number }
  | { readonly status: 'error'; readonly unauthorized?: boolean }

const balance = ref<BalanceState>({ status: 'unknown' })
let started = false

function toBalanceState(state: ReadState): BalanceState {
  return state.status === 'ok'
    ? { status: 'ok', credits: balanceToCredits(state.cents) }
    : state
}

export function refreshWorkshopCredits(
  options: { readonly force?: boolean } = {}
): Promise<void> {
  return workshopBalanceReader.refresh(options)
}

let stopActive: (() => void) | undefined

function begin(): void {
  const { session, sessionFailure, user } = useWorkshopSession()
  const stopClient = workshopBalanceReader.subscribe((state) => {
    balance.value = toBalanceState(state)
  })
  const activeScope = effectScope(true)
  activeScope.run(() => {
    watch(
      () => session.value?.token,
      (token) => {
        // Never show one workspace's balance while a newly selected
        // workspace is still loading its own wallet.
        workshopBalanceReader.reset()
        if (!token) {
          return
        }
        // A rotated token means any read in flight is about to be discarded
        // by the publish guard; joining it would skip this refresh cycle.
        void refreshWorkshopCredits({ force: true })
      },
      { immediate: true }
    )
    watch(
      [
        () => user.value?.uid,
        () => session.value?.uid,
        () => session.value?.workspace.id,
        () => sessionFailure.value?.code
      ],
      ([userUid, sessionUid, workspaceId, failure]) => {
        const active = topUpWatch.value
        if (active.status === 'idle') return
        if (
          userUid !== active.uid ||
          failure !== undefined ||
          (sessionUid !== undefined &&
            (sessionUid !== active.uid || workspaceId !== active.workspaceId))
        ) {
          clearTopUpWatch()
        }
      },
      { immediate: true }
    )
  })
  const onFocus = () => {
    if (session.value !== undefined) {
      void refreshWorkshopCredits({ force: true })
    }
  }
  window.addEventListener('focus', onFocus)
  stopActive = () => {
    stopClient()
    activeScope.stop()
    window.removeEventListener('focus', onFocus)
  }
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // This detached scope gives the module singleton its own lifetime instead
  // of binding its watchers to whichever component calls this first.
  const lifecycle = effectScope(true)
  const { settled } = useWorkshopSession()
  lifecycle.run(() => {
    watch(
      settled,
      (isSettled) => {
        stopActive?.()
        stopActive = undefined
        if (isSettled) begin()
        else {
          clearTopUpWatch()
          stopResync()
          workshopBalanceReader.reset()
        }
      },
      { immediate: true }
    )
  })
}

/**
 * Stripe grants a top-up through its webhook seconds after the buyer pays,
 * so the one refocus read usually races the grant and loses. While a
 * checkout is in flight, keep re-reading until the balance moves or
 * patience runs out — and let the dialog watch the outcome: waiting is its
 * 4a card, landed carries the receipt's ledger, unresolved is the held
 * state that names a support handle.
 */
const TOP_UP_POLL_MS = 5_000
const TOP_UP_POLL_LIMIT = 24

type TopUpWatchState =
  | { readonly status: 'idle' }
  | ({ readonly status: 'waiting' } & TopUpWatchContext)
  | ({
      readonly status: 'landed'
      readonly newCredits: number
      readonly landedAt: number
    } & TopUpWatchContext)
  | ({ readonly status: 'unresolved' } & TopUpWatchContext)

const topUpWatch = ref<TopUpWatchState>({ status: 'idle' })
let topUpPoll: ReturnType<typeof setInterval> | undefined
let topUpGeneration = 0

export function clearTopUpWatch(): void {
  topUpGeneration += 1
  if (topUpPoll) clearInterval(topUpPoll)
  topUpPoll = undefined
  topUpWatch.value = { status: 'idle' }
}

export interface TopUpWatchContext {
  readonly uid: string
  readonly workspaceId: string
  readonly workspaceName: string
  readonly previousCredits: number
}

export function watchForTopUp(context: TopUpWatchContext): void {
  if (typeof window === 'undefined') return
  clearTopUpWatch()
  const generation = topUpGeneration
  const { session, sessionFailure, user } = useWorkshopSession()
  topUpWatch.value = {
    status: 'waiting',
    ...context
  }
  let ticks = 0
  let refreshing = false
  const deadline = Date.now() + TOP_UP_POLL_MS * TOP_UP_POLL_LIMIT

  function scope(): 'current' | 'pending' | 'changed' {
    const owner = user.value
    if (!owner || owner.uid !== context.uid) return 'changed'
    const live = session.value
    if (live === undefined)
      return sessionFailure.value === undefined ? 'pending' : 'changed'
    return live.uid === context.uid && live.workspace.id === context.workspaceId
      ? 'current'
      : 'changed'
  }

  function settleFromBalance(): boolean {
    if (
      balance.value.status === 'ok' &&
      balance.value.credits > context.previousCredits
    ) {
      const newCredits = balance.value.credits
      if (topUpPoll) clearInterval(topUpPoll)
      topUpPoll = undefined
      topUpWatch.value = {
        status: 'landed',
        ...context,
        newCredits,
        landedAt: Date.now()
      }
      return true
    }
    return false
  }

  function giveUp(): void {
    if (topUpPoll) clearInterval(topUpPoll)
    topUpPoll = undefined
    topUpWatch.value = { status: 'unresolved', ...context }
  }

  function continuesInScope(): boolean {
    if (generation !== topUpGeneration) return false
    const current = scope()
    if (current === 'changed') {
      clearTopUpWatch()
      return false
    }
    if (current === 'pending' && Date.now() >= deadline) giveUp()
    return current === 'current'
  }

  async function poll(): Promise<void> {
    if (refreshing || !continuesInScope()) return
    // Only a definitely different workspace retires the watch: a snapshot
    // mid-remint has no session for a beat, and that transient must not
    // kill a checkout in flight.
    if (settleFromBalance()) return
    if (ticks >= TOP_UP_POLL_LIMIT || Date.now() >= deadline) {
      giveUp()
      return
    }
    ticks += 1
    refreshing = true
    try {
      await refreshWorkshopCredits({ force: true })
    } finally {
      refreshing = false
    }
    if (!continuesInScope()) return
    settleFromBalance()
  }

  topUpPoll = setInterval(() => void poll(), TOP_UP_POLL_MS)
  void poll()
}

/**
 * Cloud books a run's charge only after the job reports done, and the
 * balance reflects it seconds to minutes later, so one read at completion
 * almost always shows the old figure. Each mark owes one charge: the
 * re-sync re-reads with backoff until it has seen a drop for every mark or
 * the schedule runs out (free and API-only runs never move the balance).
 * Every read still publishes, so running out the schedule costs only reads.
 */
const RESYNC_DELAYS_MS = [
  0, 2_000, 5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000, 60_000
] as const

interface Resync {
  readonly scope: string
  readonly owed: number
  readonly step: number
  readonly baseline?: number
}

let resync: Resync | undefined
let resyncTimer: ReturnType<typeof setTimeout> | undefined

function sessionScope(): string | undefined {
  const current = useWorkshopSession().session.value
  return current && JSON.stringify([current.uid, current.workspace.id])
}

function currentCredits(): number | undefined {
  return balance.value.status === 'ok' ? balance.value.credits : undefined
}

function stopResync(): void {
  clearTimeout(resyncTimer)
  resyncTimer = undefined
  resync = undefined
}

function scheduleResync(): void {
  clearTimeout(resyncTimer)
  const delay = resync && RESYNC_DELAYS_MS.at(resync.step)
  if (delay === undefined) stopResync()
  else resyncTimer = setTimeout(() => void readResync(), delay)
}

function afterResyncRead(active: Resync, credits?: number): Resync {
  const charged =
    credits !== undefined &&
    active.baseline !== undefined &&
    credits < active.baseline
  return charged
    ? {
        ...active,
        owed: active.owed - 1,
        step: active.step + 1,
        baseline: credits
      }
    : { ...active, step: active.step + 1, baseline: active.baseline ?? credits }
}

async function readResync(): Promise<void> {
  const active = resync
  if (!active || sessionScope() !== active.scope) {
    stopResync()
    return
  }
  await refreshWorkshopCredits({ force: true })
  if (resync !== active) return
  resync =
    active.scope === sessionScope()
      ? afterResyncRead(active, currentCredits())
      : undefined
  if (resync && resync.owed > 0) scheduleResync()
  else stopResync()
}

export function markWorkshopCreditsDirty(): void {
  const scope = sessionScope()
  if (typeof window === 'undefined' || !scope) return
  resync =
    resync?.scope === scope
      ? { ...resync, owed: resync.owed + 1, step: 0 }
      : { scope, owed: 1, step: 0, baseline: currentCredits() }
  scheduleResync()
}

export function useTopUpWatch() {
  return computed(() => topUpWatch.value)
}

export function useWorkshopCredits() {
  start()
  const { session } = useWorkshopSession()
  return {
    balance: computed(() => balance.value),
    session
  }
}
