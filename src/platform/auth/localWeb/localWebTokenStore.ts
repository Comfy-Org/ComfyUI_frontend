import type { OAuthTokens } from '@comfyorg/account-core/oauthPkce'

/** Where this tab keeps its OAuth tokens; swapping it changes the policy. */
export interface LocalWebTokenStore {
  read(): OAuthTokens | undefined
  write(tokens: OAuthTokens): void
  clear(): void
}

/**
 * Until refresh-token storage is decided (D3), nothing is persisted: a sign-in
 * lasts as long as this tab, and a reload asks the person to sign in again.
 */
export function createMemoryTokenStore(): LocalWebTokenStore {
  let tokens: OAuthTokens | undefined
  return {
    read: () => tokens,
    write: (next) => {
      tokens = next
    },
    clear: () => {
      tokens = undefined
    }
  }
}
