import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { ErrorRecoveryStrategy } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Password update with recovery from Firebase auth/requires-recent-login:
 * the user is asked to confirm, signed out, sent through `requestSignIn`,
 * and the update is retried after a successful sign-in.
 */
export function useUpdatePassword(requestSignIn: () => Promise<boolean>) {
  const authStore = useAuthStore()
  const toast = useToast()
  const dialogService = useDialogService()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const { reportError } = useAuthActions()

  const reauthenticationRecovery: ErrorRecoveryStrategy<[string], void> = {
    shouldHandle: (error: unknown) =>
      error instanceof FirebaseError &&
      error.code === AuthErrorCodes.CREDENTIAL_TOO_OLD_LOGIN_AGAIN,

    recover: async (_error, retry, args) => {
      const confirmed = await dialogService.confirm({
        title: t('auth.reauthRequired.title'),
        message: t('auth.reauthRequired.message'),
        type: 'default'
      })

      if (!confirmed) {
        return
      }

      await authStore.logout()

      if (await requestSignIn()) {
        await retry(...args)
      }
    }
  }

  return wrapWithErrorHandlingAsync(
    async (newPassword: string) => {
      await authStore.updatePassword(newPassword)
      toast.success(t('auth.passwordUpdate.success'), {
        description: t('auth.passwordUpdate.successDetail'),
        duration: 5000
      })
    },
    reportError,
    undefined,
    [reauthenticationRecovery]
  )
}
