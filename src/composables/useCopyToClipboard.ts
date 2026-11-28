import { getCurrentScope, onScopeDispose, ref } from 'vue'

import { writeClipboardText } from '@/base/common/clipboard'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'

async function writeToClipboard(
  text: string,
  clipboardItems?: ClipboardItem[]
): Promise<boolean> {
  if (!clipboardItems) return writeClipboardText(text)
  try {
    await navigator.clipboard.write(clipboardItems)
    return true
  } catch {
    return writeClipboardText(text)
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
      toastOnSuccess = showSuccessToast,
      toastOnError = true
    }: {
      clipboardItems?: ClipboardItem[]
      toastOnSuccess?: boolean
      toastOnError?: boolean
    } = {}
  ): Promise<boolean> {
    copied.value = false
    clearTimeout(copiedReset)
    const success = await writeToClipboard(text, clipboardItems)

    if (success) {
      clearTimeout(copiedReset)
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
    } else if (toastOnError) {
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
