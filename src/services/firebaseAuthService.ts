import { t } from '@/i18n'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useToastStore } from '@/stores/toastStore'

export const useFirebaseAuthService = () => {
  const authStore = useFirebaseAuthStore()
  const toastStore = useToastStore()

  const logout = async () => {
    await authStore.logout()
    if (authStore.error) {
      toastStore.addAlert(authStore.error)
    } else {
      toastStore.add({
        severity: 'success',
        summary: t('auth.signOut.success'),
        detail: t('auth.signOut.successDetail'),
        life: 5000
      })
    }
  }

  return {
    logout
  }
}
