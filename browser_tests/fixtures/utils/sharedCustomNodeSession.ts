import type { Browser, Page } from '@playwright/test'

export const SHARED_CUSTOM_NODE_SESSION = 'CUSTOM_NODE_SHARED_SESSION'
export const SHARED_CUSTOM_NODE_CDP_ENDPOINT = 'CUSTOM_NODE_SHARED_CDP_ENDPOINT'

const SESSION_STATE_KEY = '__customNodeSharedSession'

export interface SharedCustomNodeSessionState {
  bootCount: number
  booted: boolean
  id: string
  userId?: string
}

export function sharedCustomNodeSessionEnabled(): boolean {
  return process.env[SHARED_CUSTOM_NODE_SESSION] === '1'
}

export function sharedCustomNodeEndpoint(): string | undefined {
  return process.env[SHARED_CUSTOM_NODE_CDP_ENDPOINT]
}

export async function sharedCustomNodePage(browser: Browser): Promise<Page> {
  const contexts = browser.contexts()
  if (contexts.length !== 1)
    throw new Error(
      `shared custom-node browser has ${contexts.length} contexts; expected exactly one`
    )
  const pages = contexts[0].pages()
  if (pages.length !== 1)
    throw new Error(
      `shared custom-node context has ${pages.length} pages; expected exactly one`
    )
  return pages[0]
}

export async function installSharedCustomNodeBootProbe(
  page: Page
): Promise<void> {
  await page.addInitScript((stateKey) => {
    if (window !== window.top || location.pathname !== '/') return
    const stored = sessionStorage.getItem(stateKey)
    let previous: Partial<SharedCustomNodeSessionState> = {}
    if (stored) {
      try {
        previous = JSON.parse(stored) as Partial<SharedCustomNodeSessionState>
      } catch {
        previous = {}
      }
    }
    const state: SharedCustomNodeSessionState = {
      bootCount:
        typeof previous.bootCount === 'number' ? previous.bootCount + 1 : 1,
      booted: false,
      id: typeof previous.id === 'string' ? previous.id : crypto.randomUUID()
    }
    sessionStorage.setItem(stateKey, JSON.stringify(state))
  }, SESSION_STATE_KEY)
}

export function readSharedCustomNodeSession(
  page: Page
): Promise<SharedCustomNodeSessionState | null> {
  return page.evaluate((stateKey) => {
    const stored = sessionStorage.getItem(stateKey)
    if (!stored) return null
    const state = JSON.parse(stored) as SharedCustomNodeSessionState
    return state
  }, SESSION_STATE_KEY)
}

export function markSharedCustomNodeSessionBooted(
  page: Page,
  userId: string
): Promise<SharedCustomNodeSessionState> {
  return page.evaluate(
    ({ stateKey, userId }) => {
      const stored = sessionStorage.getItem(stateKey)
      if (!stored) throw new Error('shared custom-node boot probe did not run')
      const state = JSON.parse(stored) as SharedCustomNodeSessionState
      const booted = { ...state, booted: true, userId }
      sessionStorage.setItem(stateKey, JSON.stringify(booted))
      return booted
    },
    { stateKey: SESSION_STATE_KEY, userId }
  )
}

export function assertSharedCustomNodeSession(
  state: SharedCustomNodeSessionState | null
): asserts state is SharedCustomNodeSessionState {
  if (!state?.booted)
    throw new Error('shared custom-node application boot is unavailable')
  if (state.bootCount !== 1)
    throw new Error(
      `shared custom-node application booted ${state.bootCount} times; expected exactly one boot`
    )
  if (!state.id)
    throw new Error('shared custom-node session has no page identity')
}
