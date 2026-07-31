import { describe, expect, it, vi } from 'vitest'

import { useVideoEditFormats } from './useVideoEditFormats'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${Object.values(params).join(',')}` : key
  })
}))

describe('useVideoEditFormats', () => {
  describe('formatDuration', () => {
    it('uses the zero label for empty durations', () => {
      const { formatDuration } = useVideoEditFormats()

      expect(formatDuration(0)).toBe('videoEdit.durationZero')
    })

    it('rounds to a tenth of a second', () => {
      const { formatDuration } = useVideoEditFormats()

      expect(formatDuration(2.44)).toBe('videoEdit.durationSeconds|2.4')
      expect(formatDuration(10)).toBe('videoEdit.durationSeconds|10')
    })
  })

  describe('formatFileSize', () => {
    it('shows a placeholder for unknown sizes', () => {
      const { formatFileSize } = useVideoEditFormats()

      expect(formatFileSize(undefined)).toBe('videoEdit.fileSizeUnknown')
    })

    it('picks the unit by magnitude', () => {
      const { formatFileSize } = useVideoEditFormats()

      expect(formatFileSize(500)).toBe('videoEdit.fileSizeBytes|500')
      expect(formatFileSize(1024)).toBe('videoEdit.fileSizeKilobytes|1')
      expect(formatFileSize(2048)).toBe('videoEdit.fileSizeKilobytes|2')
      expect(formatFileSize(1024 * 1024)).toBe('videoEdit.fileSizeMegabytes|1')
      expect(formatFileSize(1.3 * 1024 * 1024)).toBe(
        'videoEdit.fileSizeMegabytes|1.3'
      )
    })
  })
})
