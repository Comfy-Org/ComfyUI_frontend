import { useToast } from '@/components/ui/toast'

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
  const toast = useToast()

  async function copyToClipboard(text: string) {
    let success = false

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        success = true
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

    if (success) {
      toast.success(t('g.success'), {
        description: t('clipboard.successMessage'),
        duration: 3000
      })
    } else {
      toast.error(t('g.error'), {
        description: t('clipboard.errorMessage')
      })
    }
  }

  return {
    copyToClipboard
  }
}
