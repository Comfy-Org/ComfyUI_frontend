import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'

import { t } from '@/i18n'

export function useCopyToClipboard() {
  const { copy, copied, isSupported } = useClipboard()
  const toast = useToast()

  function fallbackCopy(text: string) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      const successful = document.execCommand('copy')
      if (successful) {
        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: t('clipboard.successMessage'),
          life: 3000
        })
      } else {
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('clipboard.errorMessage')
        })
      }
    } catch (err) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('clipboard.errorMessage')
      })
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const copyToClipboard = async (text: string) => {
    if (isSupported) {
      try {
        await copy(text)

        // Check if copy was successful
        if (copied.value) {
          toast.add({
            severity: 'success',
            summary: t('g.success'),
            detail: t('clipboard.successMessage'),
            life: 3000
          })
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
