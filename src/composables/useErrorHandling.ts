import { t } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

export function useErrorHandling() {
  const toast = useToastStore()
  const toastErrorHandler = (error: unknown) => {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: error instanceof Error ? error.message : t('g.unknownError')
    })
    console.error(error)
  }

  const wrapWithErrorHandling =
    <TArgs extends any[], TReturn>(
      action: (...args: TArgs) => TReturn,
      errorHandler?: (error: any) => void,
      finallyHandler?: () => void
    ) =>
    (...args: TArgs): TReturn | undefined => {
      try {
        return action(...args)
      } catch (e) {
        ;(errorHandler ?? toastErrorHandler)(e)
      } finally {
        finallyHandler?.()
      }
    }

  const wrapWithErrorHandlingAsync =
    <TArgs extends any[], TReturn>(
      action: (...args: TArgs) => Promise<TReturn> | TReturn,
      errorHandler?: (error: any) => void,
      finallyHandler?: () => void
    ) =>
    async (...args: TArgs): Promise<TReturn | undefined> => {
      try {
        return await action(...args)
      } catch (e) {
        ;(errorHandler ?? toastErrorHandler)(e)
      } finally {
        finallyHandler?.()
      }
    }

  return {
    wrapWithErrorHandling,
    wrapWithErrorHandlingAsync,
    toastErrorHandler
  }
}
