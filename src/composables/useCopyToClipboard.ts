import { writeClipboardText } from '@/base/common/clipboard'
import { useToast } from '@/components/ui/toast/toastStore'

import { t } from '@/i18n'

export function useCopyToClipboard() {
  const toast = useToast()

  async function copyToClipboard(
    text: string,
    {
      toastOnSuccess = true,
      toastOnError = true
    }: { toastOnSuccess?: boolean; toastOnError?: boolean } = {}
  ): Promise<boolean> {
    const success = await writeClipboardText(text)

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
