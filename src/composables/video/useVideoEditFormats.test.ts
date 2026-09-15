import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { useVideoEditFormats as useVideoEditFormatsComposable } from './useVideoEditFormats'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      videoEdit: {
        durationZero: '0s',
        durationSeconds: '{count}s',
        fileSizeUnknown: '—',
        fileSizeBytes: '{count} B',
        fileSizeKilobytes: '{count} KB',
        fileSizeMegabytes: '{count} MB'
      }
    }
  }
})

function useVideoEditFormats() {
  let composable!: ReturnType<typeof useVideoEditFormatsComposable>
  const Wrapper = defineComponent({
    setup() {
      composable = useVideoEditFormatsComposable()
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return composable
}

describe('useVideoEditFormats', () => {
  describe('formatDuration', () => {
    it('uses the zero label for empty durations', () => {
      const { formatDuration } = useVideoEditFormats()

      expect(formatDuration(0)).toBe('0s')
    })

    it('rounds to a tenth of a second', () => {
      const { formatDuration } = useVideoEditFormats()

      expect(formatDuration(2.44)).toBe('2.4s')
      expect(formatDuration(10)).toBe('10s')
    })
  })

  describe('formatTimecode', () => {
    it('formats seconds as m:ss', () => {
      const { formatTimecode } = useVideoEditFormats()

      expect(formatTimecode(0)).toBe('0:00')
      expect(formatTimecode(9.4)).toBe('0:09')
      expect(formatTimecode(90)).toBe('1:30')
      expect(formatTimecode(605)).toBe('10:05')
    })

    it('clamps negative and non-finite values to zero', () => {
      const { formatTimecode } = useVideoEditFormats()

      expect(formatTimecode(-3)).toBe('0:00')
      expect(formatTimecode(Number.NaN)).toBe('0:00')
    })
  })

  describe('formatFileSize', () => {
    it('shows a placeholder for unknown sizes', () => {
      const { formatFileSize } = useVideoEditFormats()

      expect(formatFileSize(undefined)).toBe('—')
    })

    it('picks the unit by magnitude', () => {
      const { formatFileSize } = useVideoEditFormats()

      expect(formatFileSize(500)).toBe('500 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(2048)).toBe('2 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1.3 * 1024 * 1024)).toBe('1.3 MB')
    })
  })
})
