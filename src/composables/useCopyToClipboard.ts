import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'

import { t } from '@/i18n'

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.setAttribute('readonly', '')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

export function useCopyToClipboard() {
  const { copy, copied, isSupported } = useClipboard()
  const toast = useToast()

  async function copyToClipboard(text: string) {
    let success = false

    try {
      if (isSupported.value) {
        await copy(text)
        success = copied.value
      }
    } catch {
      // Modern clipboard API failed, fall through to legacy
    }

    if (!success) {
      try {
        success = legacyCopy(text)
      } catch {
        // Legacy also failed
      }
    }

    toast.add(
      success
        ? {
            severity: 'success',
            summary: t('g.success'),
            detail: t('clipboard.successMessage'),
            life: 3000
          }
        : {
            severity: 'error',
            summary: t('g.error'),
            detail: t('clipboard.errorMessage')
          }
    )
  }

  return {
    copyToClipboard
  }
}
