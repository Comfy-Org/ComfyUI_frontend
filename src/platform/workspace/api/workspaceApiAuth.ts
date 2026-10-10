import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { setWorkspaceApiAuth } from '@/platform/workspace/api/workspaceApi'
import { useAuthStore } from '@/stores/authStore'

export function installWorkspaceApiAuth(): void {
  setWorkspaceApiAuth({
    getWorkspaceAuthHeader: () =>
      useAuthStore().getWorkspaceAuthHeaderOrThrow(),
    getFirebaseAuthHeader: () => useAuthStore().getFirebaseAuthHeaderOrThrow(),
    attachRetryInterceptor: attachUnifiedRemintInterceptor
  })
}
