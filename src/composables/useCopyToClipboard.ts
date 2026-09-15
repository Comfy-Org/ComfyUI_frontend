import { useToast } from 'primevue/usetoast'
import { getCurrentScope, onScopeDispose, ref } from 'vue'

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

export function useCopyToClipboard({
  copiedDuring,
  showSuccessToast = true
}: {
  copiedDuring?: number
  showSuccessToast?: boolean
} = {}) {
  const toast = useToast()
  const copied = ref(false)
  let copiedReset: ReturnType<typeof setTimeout> | undefined

  async function copyToClipboard(
    text: string,
    clipboardItems?: ClipboardItem[]
  ): Promise<boolean> {
    let success = false
    copied.value = false
    clearTimeout(copiedReset)

    if (clipboardItems) {
      try {
        await navigator.clipboard.write(clipboardItems)
        success = true
      } catch {
        // Rich clipboard failed, fall through to plain text
      }
    }

    if (!success) {
      try {
        await navigator.clipboard.writeText(text)
        success = true
      } catch {
        // Modern clipboard API failed, fall through to legacy
      }
    }

    if (!success) {
      try {
        success = legacyCopy(text)
      } catch {
        // Legacy also failed
      }
    }

    if (success) {
      copied.value = true
      if (copiedDuring !== undefined) {
        copiedReset = setTimeout(() => (copied.value = false), copiedDuring)
      }
      if (showSuccessToast) {
        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: t('clipboard.successMessage'),
          life: 3000
        })
      }
    } else {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('clipboard.errorMessage')
      })
    }

    return success
  }

  if (getCurrentScope()) onScopeDispose(() => clearTimeout(copiedReset))

  return {
    copied,
    copyToClipboard
  }
}
