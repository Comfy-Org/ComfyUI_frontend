import { getCurrentScope, onScopeDispose, ref } from 'vue'

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

async function writeToClipboard(
  text: string,
  clipboardItems?: ClipboardItem[]
): Promise<boolean> {
  if (clipboardItems) {
    try {
      await navigator.clipboard.write(clipboardItems)
      return true
    } catch {
      return writeToClipboard(text)
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      return legacyCopy(text)
    } catch {
      return false
    }
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
    {
      clipboardItems,
      toastOnSuccess = showSuccessToast
    }: { clipboardItems?: ClipboardItem[]; toastOnSuccess?: boolean } = {}
  ): Promise<boolean> {
    copied.value = false
    clearTimeout(copiedReset)
    const success = await writeToClipboard(text, clipboardItems)

    if (success) {
      copied.value = true
      if (copiedDuring !== undefined) {
        copiedReset = setTimeout(() => (copied.value = false), copiedDuring)
      }
      if (toastOnSuccess) {
        toast.success(t('g.success'), {
          description: t('clipboard.successMessage'),
          duration: 3000
        })
      }
    } else {
      toast.error(t('g.error'), {
        description: t('clipboard.errorMessage')
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
