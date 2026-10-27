import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { setIngestApiAuth } from '@/platform/remote/ingest/ingestApi'
import { useAuthStore } from '@/stores/authStore'
import { attachRetryableStatusRetry } from '@/utils/axiosRetryableStatus'

export function installWorkspaceApiAuth(): void {
  setIngestApiAuth({
    getWorkspaceAuthHeader: () =>
      useAuthStore().getWorkspaceAuthHeaderOrThrow(),
    getFirebaseAuthHeader: () => useAuthStore().getFirebaseAuthHeaderOrThrow(),
    attachRetryInterceptor: (client) => {
      attachRetryableStatusRetry(client)
      attachUnifiedRemintInterceptor(client)
    }
  })
}
