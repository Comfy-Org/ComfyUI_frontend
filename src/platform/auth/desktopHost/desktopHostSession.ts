import { computed, readonly, ref, shallowRef } from 'vue'

import { z } from 'zod'

import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState,
  DesktopHostBillingHandoff,
  DesktopHostBillingIntent,
  DesktopHostBillingReceiver
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
let lastTokenReadFailed = false
const recoveredTokenReads = ref(0)

/** Counts credential reads that succeeded right after a failed one. */
export const desktopHostTokenRecoveries = readonly(recoveredTokenReads)

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

/** Changes whenever the Desktop account or workspace changes. */
export function desktopHostSessionRevision(): number {
  return revision
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
  lastTokenReadFailed = false
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
  return fetchToken((current) => current.getWorkspaceToken(workspaceId), {
    tracksRecovery: true
  })
}

/**
 * The partner-node token Desktop minted and renews for `workspaceId`, under
 * the same rules as {@link desktopHostWorkspaceToken}. Resolves undefined when
 * Desktop has none or its build cannot mint one.
 */
export function desktopHostPartnerNodeToken(
  workspaceId: string
): Promise<string | undefined> {
  return fetchToken(
    async (current) =>
      (await current.getPartnerNodeToken?.(workspaceId)) ?? null
  )
}

async function fetchToken(
  read: (current: DesktopHostAuthBridge) => Promise<string | null>,
  { tracksRecovery = false }: { tracksRecovery?: boolean } = {}
): Promise<string | undefined> {
  const current = bridge
  if (!current || session.value.status !== 'signed_in') return undefined
  const before = revision
  const token = await read(current).catch(() => null)
  if (revision !== before) return undefined
  if (tracksRecovery) {
    if (token && lastTokenReadFailed) recoveredTokenReads.value++
    lastTokenReadFailed = !token
  }
  return token ?? undefined
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

const zDesktopHostBillingHandoff = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('issued'),
    entryUrl: z.url({ protocol: /^https$/ })
  }),
  z.object({ status: z.literal('sign_in_again') }),
  z.object({
    status: z.literal('refused'),
    code: z.string().optional(),
    message: z.string().optional()
  }),
  z.object({ status: z.literal('disabled') })
])

const UNEXPLAINED_REFUSAL: DesktopHostBillingHandoff = { status: 'refused' }

const BILLING_HANDOFF_TIMEOUT_MS = 40_000

function refusedAfter(ms: number): {
  refusal: Promise<DesktopHostBillingHandoff>
  cancel: () => void
} {
  let timer: ReturnType<typeof setTimeout> | undefined
  const refusal = new Promise<DesktopHostBillingHandoff>((resolve) => {
    timer = setTimeout(() => resolve(UNEXPLAINED_REFUSAL), ms)
  })
  return { refusal, cancel: () => clearTimeout(timer) }
}

export function canDesktopHostIssueBillingHandoff(): boolean {
  return isDesktopHostSignedIn() && bridge?.issueBillingHandoff !== undefined
}

/** Asks Desktop to issue a billing handoff with its own credential; only the entry URL comes back. */
export async function issueDesktopHostBillingHandoff(
  workspaceId: string,
  receiver: DesktopHostBillingReceiver,
  intent: DesktopHostBillingIntent,
  amountCents?: number
): Promise<DesktopHostBillingHandoff> {
  const current = bridge
  if (!current?.issueBillingHandoff || !isDesktopHostSignedIn())
    return { status: 'disabled' }
  const deadline = refusedAfter(BILLING_HANDOFF_TIMEOUT_MS)
  const answer = await Promise.race([
    Promise.resolve()
      .then(() =>
        current.issueBillingHandoff?.(
          workspaceId,
          receiver,
          intent,
          amountCents
        )
      )
      .catch(() => UNEXPLAINED_REFUSAL),
    deadline.refusal
  ]).finally(deadline.cancel)
  const parsed = zDesktopHostBillingHandoff.safeParse(answer)
  return parsed.success ? parsed.data : UNEXPLAINED_REFUSAL
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
