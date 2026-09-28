import { getCurrentScope, onScopeDispose, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

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

async function writeToClipboard(
  text: string,
  clipboardItems?: ClipboardItem[]
): Promise<boolean> {
  if (clipboardItems) {
    try {
      await navigator.clipboard.write(clipboardItems)
      return true
    } catch {
      // Rich clipboard failed, fall through to plain text
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Modern clipboard API failed, fall through to legacy
  }

  try {
    return legacyCopy(text)
  } catch {
    return false
  }
}

export function useCopyToClipboard({
  copiedDuring,
  showSuccessToast = true
}: {
  copiedDuring?: number
  showSuccessToast?: boolean
} = {}) {
  const toast = useToastStore()
  const copied = ref(false)
  let copiedReset: ReturnType<typeof setTimeout> | undefined

  async function copyToClipboard(
    text: string,
    clipboardItems?: ClipboardItem[]
  ): Promise<boolean> {
    copied.value = false
    clearTimeout(copiedReset)
    const success = await writeToClipboard(text, clipboardItems)

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
