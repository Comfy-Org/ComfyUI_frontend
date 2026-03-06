import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

export const MAX_IMAGE_SIZE_MB = 10
export const MAX_VIDEO_SIZE_MB = 50

export function isFileTooLarge(file: File, maxSizeMB: number): boolean {
  const fileSizeMB = file.size / 1024 / 1024
  if (fileSizeMB <= maxSizeMB) return false

  useToastStore().add({
    severity: 'error',
    summary: t('g.error'),
    detail: t('toastMessages.fileTooLarge', {
      size: fileSizeMB.toFixed(1),
      maxSize: maxSizeMB
    })
  })
  return true
}
