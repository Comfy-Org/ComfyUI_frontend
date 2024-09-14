import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

export function useErrorHandling() {
  const toast = useToast()
  const { t } = useI18n()

  const wrapWithErrorHandling =
    (action: (...args: any[]) => any, errorHandler?: (error: any) => void) =>
    (...args: any[]) => {
      try {
        return action(...args)
      } catch (e) {
        if (errorHandler) {
          errorHandler(e)
        } else {
          toast.add({
            severity: 'error',
            summary: t('error'),
            detail: e.message,
            life: 3000
          })
        }
      }
    }

  return { wrapWithErrorHandling }
}
