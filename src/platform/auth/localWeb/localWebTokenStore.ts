import type { OAuthTokens } from '@comfyorg/account-core/oauthPkce'
import { omit } from 'es-toolkit'
import { z } from 'zod'

/** Where this page keeps its OAuth tokens; swapping it changes the policy. */
export interface LocalWebTokenStore {
  read(): OAuthTokens | undefined
  /** False when the storage refused the write, so nothing was persisted. */
  write(tokens: OAuthTokens): boolean
  /** Tokens kept for a workspace this page signed in to before, if any. */
  readWorkspace(workspaceId: string): OAuthTokens | undefined
  /** False when the storage refused the write, so nothing was persisted. */
  writeWorkspace(workspaceId: string, tokens: OAuthTokens): boolean
  /** Forgets one workspace's kept tokens, only if they are still `stale`. */
  forgetWorkspace(workspaceId: string, stale: OAuthTokens): void
  /** Forgets the active tokens and every workspace's tokens. */
  clear(): void
  /** Calls back when another tab changes the stored or kept tokens. */
  subscribe(listener: () => void): () => void
}

export const LOCAL_WEB_TOKENS_KEY = 'Comfy.LocalWebSignIn.Tokens'
const LOCAL_WEB_WORKSPACE_TOKENS_KEY = 'Comfy.LocalWebSignIn.WorkspaceTokens'

type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const zStoredTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  scope: z.string()
})

const zStoredWorkspaceTokens = z.record(z.string(), zStoredTokens)

export function createMemoryTokenStore(): LocalWebTokenStore {
  let tokens: OAuthTokens | undefined
  const byWorkspace = new Map<string, OAuthTokens>()
  return {
    read: () => tokens,
    write: (next) => {
      tokens = next
      return true
    },
    readWorkspace: (workspaceId) => byWorkspace.get(workspaceId),
    writeWorkspace: (workspaceId, next) => {
      byWorkspace.set(workspaceId, next)
      return true
    },
    forgetWorkspace: (workspaceId, stale) => {
      if (byWorkspace.get(workspaceId)?.refreshToken === stale.refreshToken)
        byWorkspace.delete(workspaceId)
    },
    clear: () => {
      tokens = undefined
      byWorkspace.clear()
    },
    subscribe: () => () => {}
  }
}

function parseStoredTokens(raw: string | null): OAuthTokens | undefined {
  if (raw === null) return undefined
  try {
    const parsed = zStoredTokens.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

function parseStoredWorkspaceTokens(
  raw: string | null
): Record<string, OAuthTokens> {
  if (raw === null) return {}
  try {
    const parsed = zStoredWorkspaceTokens.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function ignoringStorageErrors<T>(access: () => T, fallback: T): T {
  try {
    return access()
  } catch {
    return fallback
  }
}

/**
 * Keeps the tokens in origin storage so a reload or a new tab stays signed
 * in, the same persistence Firebase sign-in already uses on this origin.
 */
export function createStorageTokenStore(
  storage: TokenStorage,
  storageEvents: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
): LocalWebTokenStore {
  const readWorkspaces = () =>
    parseStoredWorkspaceTokens(
      ignoringStorageErrors(
        () => storage.getItem(LOCAL_WEB_WORKSPACE_TOKENS_KEY),
        null
      )
    )
  return {
    read: () =>
      parseStoredTokens(
        ignoringStorageErrors(() => storage.getItem(LOCAL_WEB_TOKENS_KEY), null)
      ),
    write: (tokens) =>
      ignoringStorageErrors(() => {
        storage.setItem(LOCAL_WEB_TOKENS_KEY, JSON.stringify(tokens))
        return true
      }, false),
    readWorkspace: (workspaceId) => readWorkspaces()[workspaceId],
    writeWorkspace: (workspaceId, tokens) =>
      ignoringStorageErrors(() => {
        storage.setItem(
          LOCAL_WEB_WORKSPACE_TOKENS_KEY,
          JSON.stringify({ ...readWorkspaces(), [workspaceId]: tokens })
        )
        return true
      }, false),
    forgetWorkspace(workspaceId, stale) {
      ignoringStorageErrors(() => {
        const workspaces = readWorkspaces()
        if (workspaces[workspaceId]?.refreshToken !== stale.refreshToken) return
        storage.setItem(
          LOCAL_WEB_WORKSPACE_TOKENS_KEY,
          JSON.stringify(omit(workspaces, [workspaceId]))
        )
      }, undefined)
    },
    clear() {
      ignoringStorageErrors(() => {
        storage.removeItem(LOCAL_WEB_TOKENS_KEY)
        storage.removeItem(LOCAL_WEB_WORKSPACE_TOKENS_KEY)
      }, undefined)
    },
    subscribe(listener) {
      const onStorage = (event: Event) => {
        const key = 'key' in event ? event.key : undefined
        if (
          key === LOCAL_WEB_TOKENS_KEY ||
          key === LOCAL_WEB_WORKSPACE_TOKENS_KEY ||
          key === null
        )
          listener()
      }
      storageEvents.addEventListener('storage', onStorage)
      return () => storageEvents.removeEventListener('storage', onStorage)
    }
  }
}
