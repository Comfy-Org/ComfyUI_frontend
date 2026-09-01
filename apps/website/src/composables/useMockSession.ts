import { onMounted, readonly, ref } from 'vue'

export interface MockAccount {
  readonly name: string
  readonly email: string
  readonly workspace: string
  readonly credits: number
}

export type MockSession =
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly account: MockAccount }

export type MockSessionEvent =
  | { type: 'signIn' }
  | { type: 'signOut' }
  | { type: 'setCredits'; credits: number }

export const DEFAULT_ACCOUNT: MockAccount = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  workspace: "Ada's Studio",
  credits: 1250
}

const SIGNED_OUT: MockSession = { status: 'signedOut' }
const STORAGE_KEY = 'comfy-workshop-mock-session'

export function transition(
  session: MockSession,
  event: MockSessionEvent
): MockSession {
  switch (event.type) {
    case 'signIn':
      return session.status === 'signedIn'
        ? session
        : { status: 'signedIn', account: DEFAULT_ACCOUNT }
    case 'signOut':
      return SIGNED_OUT
    case 'setCredits':
      return session.status === 'signedIn'
        ? {
            status: 'signedIn',
            account: { ...session.account, credits: event.credits }
          }
        : session
  }
}

function readStoredSession(): MockSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SIGNED_OUT
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'status' in parsed &&
      parsed.status === 'signedIn' &&
      'account' in parsed &&
      typeof parsed.account === 'object' &&
      parsed.account !== null &&
      'credits' in parsed.account &&
      typeof parsed.account.credits === 'number'
    ) {
      return {
        status: 'signedIn',
        account: { ...DEFAULT_ACCOUNT, credits: parsed.account.credits }
      }
    }
    return SIGNED_OUT
  } catch {
    return SIGNED_OUT
  }
}

function storeSession(session: MockSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* storage unavailable */
  }
}

const session = ref<MockSession>(SIGNED_OUT)
let hydrated = false

export function useMockSession() {
  onMounted(() => {
    if (hydrated) return
    session.value = readStoredSession()
    hydrated = true
  })

  function dispatch(event: MockSessionEvent) {
    session.value = transition(session.value, event)
    storeSession(session.value)
  }

  return {
    session: readonly(session),
    signIn: () => dispatch({ type: 'signIn' }),
    signOut: () => dispatch({ type: 'signOut' }),
    setCredits: (credits: number) => dispatch({ type: 'setCredits', credits })
  }
}
