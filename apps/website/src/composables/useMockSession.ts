import { onMounted, readonly, ref } from 'vue'

export interface MockAccount {
  readonly name: string
  readonly email: string
  readonly workspace: string
  readonly credits: number
  readonly subscribed: boolean
  readonly role: 'owner' | 'member'
}

export type MockSession =
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly account: MockAccount }

export type AccountKind = 'new' | 'existing'

export type MockSessionEvent =
  | { type: 'signIn'; kind: AccountKind }
  | { type: 'signOut' }
  | { type: 'setCredits'; credits: number }
  | { type: 'addCredits'; credits: number }
  | { type: 'setSubscribed'; subscribed: boolean }
  | { type: 'switchWorkspace'; workspace: string }
  | { type: 'setRole'; role: 'owner' | 'member' }

// Nothing is free: a new account starts empty and buys credits to run;
// existing ones carry whatever they bought.
export const WELCOME_CREDITS = 0
export const EXISTING_CREDITS = 5840
export const LOW_CREDITS = 3

export const WORKSPACES = ["Ada's Studio", 'Comfy team', 'Client demos']
export const PERSONAL_WORKSPACE = WORKSPACES[0]
const TEAM_WORKSPACE = WORKSPACES[1]

const BASE_ACCOUNT = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  workspace: WORKSPACES[0],
  role: 'owner' as const
}

export function accountFor(kind: AccountKind): MockAccount {
  return kind === 'new'
    ? { ...BASE_ACCOUNT, credits: WELCOME_CREDITS, subscribed: false }
    : { ...BASE_ACCOUNT, credits: EXISTING_CREDITS, subscribed: true }
}

const SIGNED_OUT: MockSession = { status: 'signedOut' }
const STORAGE_KEY = 'comfy-workshop-mock-session'

export function transition(
  session: MockSession,
  event: MockSessionEvent
): MockSession {
  switch (event.type) {
    case 'signIn':
      return { status: 'signedIn', account: accountFor(event.kind) }
    case 'signOut':
      return SIGNED_OUT
    case 'setRole':
      // A member browses the team workspace on someone else's balance.
      return session.status === 'signedIn'
        ? {
            status: 'signedIn',
            account:
              event.role === 'member'
                ? {
                    ...session.account,
                    role: 'member',
                    workspace: TEAM_WORKSPACE,
                    credits: 0
                  }
                : {
                    ...session.account,
                    role: 'owner',
                    workspace: PERSONAL_WORKSPACE,
                    credits: EXISTING_CREDITS
                  }
          }
        : session
    case 'switchWorkspace':
      return session.status === 'signedIn'
        ? {
            status: 'signedIn',
            account: {
              ...session.account,
              workspace: event.workspace,
              ...(event.workspace === PERSONAL_WORKSPACE
                ? {
                    role: 'owner' as const,
                    credits:
                      session.account.role === 'member'
                        ? EXISTING_CREDITS
                        : session.account.credits
                  }
                : {})
            }
          }
        : session
    case 'setCredits':
    case 'addCredits':
    case 'setSubscribed': {
      if (session.status !== 'signedIn') return session
      const account = session.account
      const patch =
        event.type === 'setCredits'
          ? { credits: Math.max(0, event.credits) }
          : event.type === 'addCredits'
            ? { credits: Math.max(0, account.credits + event.credits) }
            : { subscribed: event.subscribed }
      return { status: 'signedIn', account: { ...account, ...patch } }
    }
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
      const subscribed =
        'subscribed' in parsed.account && parsed.account.subscribed === true
      const workspace =
        'workspace' in parsed.account &&
        typeof parsed.account.workspace === 'string'
          ? parsed.account.workspace
          : BASE_ACCOUNT.workspace
      return {
        status: 'signedIn',
        account: {
          ...BASE_ACCOUNT,
          workspace,
          credits: parsed.account.credits,
          subscribed
        }
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
    signIn: (kind: AccountKind = 'existing') =>
      dispatch({ type: 'signIn', kind }),
    signOut: () => dispatch({ type: 'signOut' }),
    switchWorkspace: (workspace: string) =>
      dispatch({ type: 'switchWorkspace', workspace }),
    setCredits: (credits: number) => dispatch({ type: 'setCredits', credits }),
    addCredits: (credits: number) => dispatch({ type: 'addCredits', credits }),
    setSubscribed: (subscribed: boolean) =>
      dispatch({ type: 'setSubscribed', subscribed }),
    setRole: (role: 'owner' | 'member') => dispatch({ type: 'setRole', role })
  }
}
