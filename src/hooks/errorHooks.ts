import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'

export function useErrorHandling() {
  const toast = useToastStore()
  const { t } = useI18n()

  const toastErrorHandler = (error: any) => {
    toast.add({
      severity: 'error',
      summary: t('error'),
      detail: error.message,
      life: 3000
    })
  }

  const wrapWithErrorHandling =
    (
      action: (...args: any[]) => any,
      errorHandler?: (error: any) => void,
      finallyHandler?: () => void
    ) =>
    (...args: any[]) => {
      try {
        return action(...args)
      } catch (e) {
        ;(errorHandler ?? toastErrorHandler)(e)
      } finally {
        finallyHandler?.()
      }
    }

  const wrapWithErrorHandlingAsync =
    (
      action: ((...args: any[]) => Promise<any>) | ((...args: any[]) => any),
      errorHandler?: (error: any) => void,
      finallyHandler?: () => void
    ) =>
    async (...args: any[]) => {
      try {
        return await action(...args)
      } catch (e) {
        ;(errorHandler ?? toastErrorHandler)(e)
      } finally {
        finallyHandler?.()
      }
    }

  return { wrapWithErrorHandling, wrapWithErrorHandlingAsync }
}
