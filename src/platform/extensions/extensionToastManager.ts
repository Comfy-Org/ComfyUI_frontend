import type { useToast } from '@/components/ui/toast/toastStore'
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
  function add(message: ToastMessageOptions) {
    const kind = legacySeverityKinds[message.severity ?? 'info']
    toast[kind](message.summary ?? message.detail ?? '', {
      description: message.summary === undefined ? undefined : message.detail,
      duration: message.life || undefined,
      closable: message.closable
    })
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
    addAlert: (message) => toast.warning(message)
  }
}
