import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { setIngestApiAuth } from '@/platform/remote/ingest/ingestApi'
import { useAuthStore } from '@/stores/authStore'

export function installWorkspaceApiAuth(): void {
  setIngestApiAuth({
    getWorkspaceAuthHeader: () =>
      useAuthStore().getWorkspaceAuthHeaderOrThrow(),
    getFirebaseAuthHeader: () => useAuthStore().getFirebaseAuthHeaderOrThrow(),
    attachRetryInterceptor: attachUnifiedRemintInterceptor
  })
}
