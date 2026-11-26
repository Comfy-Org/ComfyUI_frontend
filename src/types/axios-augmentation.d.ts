import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    // Latches a single reactive 401 retry so a replayed request cannot trigger
    // a second re-mint.
    __unifiedRetried?: boolean
    // Exempts a deliberately Firebase-authed request (acceptInvite) from the
    // unified re-mint.
    __skipUnifiedRemint?: boolean
    /** Sends once, skipping the shared 429/502/503/504 retry. */
    __skipStatusRetry?: boolean
  }
}
