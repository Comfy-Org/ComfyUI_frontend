import { useToast } from '@/components/ui/toast/toastStore'

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

  async function copyToClipboard(
    text: string,
    {
      toastOnSuccess = true,
      toastOnError = true
    }: { toastOnSuccess?: boolean; toastOnError?: boolean } = {}
  ): Promise<boolean> {
    let success: boolean

    try {
      await navigator.clipboard.writeText(text)
      success = true
    } catch {
      try {
        success = legacyCopy(text)
      } catch {
        success = false
      }
    }

    if (success && toastOnSuccess) {
      toast.success(t('g.success'), {
        description: t('clipboard.successMessage'),
        duration: 3000
      })
    } else if (!success && toastOnError) {
      toast.error(t('g.error'), {
        description: t('clipboard.errorMessage')
      })
    }
    return success
  }

  return {
    copyToClipboard
  }
}
