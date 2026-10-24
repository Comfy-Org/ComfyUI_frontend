import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { setWorkspaceApiAuth } from '@/platform/workspace/api/workspaceApi'
import { useAuthStore } from '@/stores/authStore'
import { attachRetryableStatusRetry } from '@/utils/axiosRetryableStatus'

export function installWorkspaceApiAuth(): void {
  setWorkspaceApiAuth({
    getWorkspaceAuthHeader: () =>
      useAuthStore().getWorkspaceAuthHeaderOrThrow(),
    getFirebaseAuthHeader: () => useAuthStore().getFirebaseAuthHeaderOrThrow(),
    attachRetryInterceptor: (client) => {
      attachRetryableStatusRetry(client)
      attachUnifiedRemintInterceptor(client)
    }
  })
}
