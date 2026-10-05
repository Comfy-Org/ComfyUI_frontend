import type { useToast } from '@/components/ui/toast/toastStore'
import type { ToastId } from '@/types/toastId'
import type { ToastManager, ToastMessageOptions } from '@/types/extensionTypes'

const legacySeverityKinds = {
  success: 'success',
  info: 'info',
  warn: 'warning',
  error: 'error',
  secondary: 'info',
  contrast: 'info'
} as const

export function createExtensionToastManager(
  toast: ReturnType<typeof useToast>
): ToastManager {
  const legacyToastIds = new WeakMap<ToastMessageOptions, ToastId>()

  function add(message: ToastMessageOptions) {
    const kind = legacySeverityKinds[message.severity ?? 'info']
    const id = toast[kind](message.summary ?? message.detail ?? '', {
      description: message.summary === undefined ? undefined : message.detail,
      duration: message.life || undefined,
      closable: message.closable
    })
    legacyToastIds.set(message, id)
  }

  function remove(message: ToastMessageOptions) {
    const id = legacyToastIds.get(message)
    if (id !== undefined) toast.dismiss(id)
  }

  return {
    success: toast.success,
    error: toast.error,
    info: toast.info,
    warning: toast.warning,
    loading: toast.loading,
    dismiss: toast.dismiss,
    dismissAll: toast.dismissAll,
    add,
    remove,
    removeAll: toast.dismissAll,
    addAlert: (message) =>
      add({ severity: 'warn', summary: 'Alert', detail: message })
  }
}
