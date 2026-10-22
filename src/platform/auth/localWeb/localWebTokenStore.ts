import type { OAuthTokens } from '@comfyorg/account-core/oauthPkce'
import { z } from 'zod'

/** Where this page keeps its OAuth tokens; swapping it changes the policy. */
export interface LocalWebTokenStore {
  read(): OAuthTokens | undefined
  /** False when the storage refused the write, so nothing was persisted. */
  write(tokens: OAuthTokens): boolean
  clear(): void
  /** Calls back when another tab changes the stored tokens. */
  subscribe(listener: () => void): () => void
}

export const LOCAL_WEB_TOKENS_KEY = 'Comfy.LocalWebSignIn.Tokens'

type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const zStoredTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  scope: z.string()
})

export function createMemoryTokenStore(): LocalWebTokenStore {
  let tokens: OAuthTokens | undefined
  return {
    read: () => tokens,
    write: (next) => {
      tokens = next
      return true
    },
    clear: () => {
      tokens = undefined
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
    clear() {
      ignoringStorageErrors(
        () => storage.removeItem(LOCAL_WEB_TOKENS_KEY),
        undefined
      )
    },
    subscribe(listener) {
      const onStorage = (event: Event) => {
        const key = 'key' in event ? event.key : undefined
        if (key === LOCAL_WEB_TOKENS_KEY || key === null) listener()
      }
      storageEvents.addEventListener('storage', onStorage)
      return () => storageEvents.removeEventListener('storage', onStorage)
    }
  }
}
