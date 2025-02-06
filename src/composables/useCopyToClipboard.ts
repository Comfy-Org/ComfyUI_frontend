import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'

import { t } from '@/i18n'

export function useCopyToClipboard() {
  const { copy, isSupported } = useClipboard()
  const toast = useToast()

  const copyToClipboard = async (text: string) => {
    if (isSupported) {
      try {
        await copy(text)
        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: t('clipboard.successMessage'),
          life: 3000
        })
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('clipboard.errorMessage')
        })
      }
    } else {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('clipboard.errorNotSupported')
      })
    }
  }

  return {
    copyToClipboard
  }
}
