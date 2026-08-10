import { useI18n } from 'vue-i18n'

export function useVideoEditFormats() {
  const { t } = useI18n()

  function formatDuration(seconds: number) {
    if (!seconds) return t('videoEdit.durationZero')
    return t('videoEdit.durationSeconds', {
      count: Math.round(seconds * 10) / 10
    })
  }

  function formatFileSize(bytes?: number) {
    if (bytes == null) return t('videoEdit.fileSizeUnknown')
    if (bytes < 1024) {
      return t('videoEdit.fileSizeBytes', { count: bytes })
    }
    if (bytes < 1024 * 1024) {
      return t('videoEdit.fileSizeKilobytes', {
        count: Math.round(bytes / 1024)
      })
    }
    return t('videoEdit.fileSizeMegabytes', {
      count: Number((bytes / (1024 * 1024)).toFixed(1))
    })
  }

  return { formatDuration, formatFileSize }
}
