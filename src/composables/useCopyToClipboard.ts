import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'

export function useCopyToClipboard() {
  const { copy, isSupported } = useClipboard()
  const toast = useToast()

  const copyToClipboard = async (text: string) => {
    if (isSupported) {
      try {
        await copy(text)
        toast.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Copied to clipboard',
          life: 3000
        })
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to copy report'
        })
      }
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Clipboard API not supported in your browser'
      })
    }
  }

  return {
    copyToClipboard
  }
}
