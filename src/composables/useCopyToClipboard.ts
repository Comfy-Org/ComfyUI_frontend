import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'

import { t } from '@/i18n'

export function useCopyToClipboard() {
  const { copy, copied } = useClipboard()
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
    textarea.setAttribute('readonly', '')
    textarea.value = text
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'
    textarea.setAttribute('aria-hidden', 'true')
    textarea.setAttribute('tabindex', '-1')
    textarea.style.width = '1px'
    textarea.style.height = '1px'
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
  }

  return {
    copyToClipboard
  }
}
