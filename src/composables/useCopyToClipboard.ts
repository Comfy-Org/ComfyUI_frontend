import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'

import { t } from '@/i18n'

export function useCopyToClipboard() {
  const { copy, copied, isSupported } = useClipboard()
  const toast = useToast()
  const showSuccessToast = () => {
    toast.add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('clipboard.successMessage'),
      life: 3000
    })
  }
  const showErrorToast = () => {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('clipboard.errorMessage')
    })
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      // using legacy document.execCommand for fallback for old and linux browsers
      const successful = document.execCommand('copy')
      if (successful) {
        showSuccessToast()
      } else {
        showErrorToast()
      }
    } catch (err) {
      showErrorToast()
    } finally {
      textarea.remove()
    }
  }

  const copyToClipboard = async (text: string) => {
    if (isSupported) {
      try {
        await copy(text)
        if (copied.value) {
          showSuccessToast()
        } else {
          // If VueUse copy failed, try fallback
          fallbackCopy(text)
        }
      } catch (err) {
        // VueUse copy failed, try fallback
        fallbackCopy(text)
      }
    } else {
      // Clipboard API not supported, use fallback
      fallbackCopy(text)
    }
  }

  return {
    copyToClipboard
  }
}
