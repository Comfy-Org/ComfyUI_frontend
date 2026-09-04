import type { AccountKind } from '../composables/useMockSession'
import type {
  ModelState,
  RunOutcome,
  Version
} from '../composables/usePrototypeTweaks'
import {
  MODEL_STATES,
  RUN_OUTCOMES,
  VERSIONS
} from '../composables/usePrototypeTweaks'

export type SessionChoice = 'signedOut' | AccountKind
type BalanceChoice = 'normal' | 'zero' | 'low'

// Everything the prototype controls can set, so one link reproduces a setup.
export interface ShareState {
  readonly version: Version
  readonly showStatuses: boolean
  readonly groupVersions: boolean
  readonly session: SessionChoice
  readonly subscribed: boolean
  readonly balance: BalanceChoice
  readonly member: boolean
  readonly outcome: RunOutcome
  readonly modelState: ModelState
}

export const SHARE_DEFAULTS: ShareState = {
  version: 'v1',
  showStatuses: false,
  groupVersions: false,
  session: 'signedOut',
  subscribed: true,
  balance: 'normal',
  member: false,
  outcome: 'success',
  modelState: 'none'
}

const SESSION_CHOICES: readonly SessionChoice[] = [
  'signedOut',
  'new',
  'existing'
]
const BALANCE_CHOICES: readonly BalanceChoice[] = ['normal', 'zero', 'low']

const KEYS = {
  version: 'version',
  showStatuses: 'statuses',
  groupVersions: 'families',
  session: 'session',
  subscribed: 'subscribed',
  balance: 'balance',
  member: 'member',
  outcome: 'outcome',
  modelState: 'state'
} as const

const flag = (value: boolean) => (value ? '1' : '0')

// Only what differs from the defaults goes into the link; other query
// parameters on the page (catalog filters, Hub tabs) are kept as they are.
export function encodeShareSearch(state: ShareState, base = ''): string {
  const params = new URLSearchParams(base)
  for (const key of Object.values(KEYS)) params.delete(key)
  for (const [field, key] of Object.entries(KEYS) as [
    keyof ShareState,
    string
  ][]) {
    const value = state[field]
    if (value === SHARE_DEFAULTS[field]) continue
    if (field === 'subscribed' && state.session === 'signedOut') continue
    params.set(key, typeof value === 'boolean' ? flag(value) : String(value))
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

function pick<T extends string | number>(
  options: readonly T[],
  raw: string | null
): T | undefined {
  return raw === null
    ? undefined
    : options.find((option) => String(option) === raw)
}

function pickFlag(raw: string | null): boolean | undefined {
  return raw === '1' ? true : raw === '0' ? false : undefined
}

export function decodeShareSearch(search: string): Partial<ShareState> {
  const params = new URLSearchParams(search)
  const decoded: Partial<ShareState> = {
    version: pick(VERSIONS, params.get(KEYS.version)),
    showStatuses: pickFlag(params.get(KEYS.showStatuses)),
    groupVersions: pickFlag(params.get(KEYS.groupVersions)),
    session: pick(SESSION_CHOICES, params.get(KEYS.session)),
    subscribed: pickFlag(params.get(KEYS.subscribed)),
    balance: pick(BALANCE_CHOICES, params.get(KEYS.balance)),
    member: pickFlag(params.get(KEYS.member)),
    outcome: pick(RUN_OUTCOMES, params.get(KEYS.outcome)),
    modelState: pick(MODEL_STATES, params.get(KEYS.modelState))
  }
  return Object.fromEntries(
    Object.entries(decoded).filter(([, value]) => value !== undefined)
  )
}
