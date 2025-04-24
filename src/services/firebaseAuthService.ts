import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useToastStore } from '@/stores/toastStore'

export const useFirebaseAuthService = () => {
  const authStore = useFirebaseAuthStore()
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const reportError = (error: unknown) => {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: error instanceof Error ? error.message : t('g.unknownError'),
      life: 5000
    })
  }

  const logout = wrapWithErrorHandlingAsync(async () => {
    await authStore.logout()
    toastStore.add({
      severity: 'success',
      summary: t('auth.signOut.success'),
      detail: t('auth.signOut.successDetail'),
      life: 5000
    })
  }, reportError)

  const sendPasswordReset = wrapWithErrorHandlingAsync(
    async (email: string) => {
      await authStore.sendPasswordReset(email)
      toastStore.add({
        severity: 'success',
        summary: t('auth.login.passwordResetSent'),
        detail: t('auth.login.passwordResetSentDetail'),
        life: 5000
      })
    },
    reportError
  )

  return {
    logout,
    sendPasswordReset
  }
}
