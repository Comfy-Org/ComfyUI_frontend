import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '@/components/ui/toast'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'

const mockToastAdd = vi.fn()

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation((...args: unknown[]) =>
    mockToastAdd('success', ...args)
  )
  vi.mocked(useToast().error).mockImplementation((...args: unknown[]) =>
    mockToastAdd('error', ...args)
  )
  vi.mocked(useToast().info).mockImplementation((...args: unknown[]) =>
    mockToastAdd('info', ...args)
  )
  vi.mocked(useToast().warning).mockImplementation((...args: unknown[]) =>
    mockToastAdd('warning', ...args)
  )
  vi.mocked(useToast().loading).mockImplementation((...args: unknown[]) =>
    mockToastAdd('loading', ...args)
  )
  vi.mocked(useToast().custom).mockImplementation((...args: unknown[]) =>
    mockToastAdd('custom', ...args)
  )
})

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

function renderPlayer(modelValue?: string) {
  return render(AudioPreviewPlayer, {
    props: {
      modelValue,
      hideWhenEmpty: false
    },
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
        TieredMenu: true,
        Slider: true
      }
    }
  })
}

describe('AudioPreviewPlayer', () => {
  describe('download button', () => {
    it('shows download button when audio is loaded', () => {
      renderPlayer('http://example.com/audio.mp3')

      screen.getByRole('button', { name: 'g.downloadAudio' })
    })

    it('hides download button when no audio is loaded', () => {
      renderPlayer()

      expect(
        screen.queryByRole('button', { name: 'g.downloadAudio' })
      ).not.toBeInTheDocument()
    })

    it('calls downloadFile when download button is clicked', async () => {
      const { downloadFile } = await import('@/base/common/downloadUtil')
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.mp3')
      await user.click(screen.getByRole('button', { name: 'g.downloadAudio' }))

      expect(downloadFile).toHaveBeenCalledWith('http://example.com/audio.mp3')
    })

    it('shows toast on download failure', async () => {
      const { downloadFile } = await import('@/base/common/downloadUtil')
      vi.mocked(downloadFile).mockImplementation(() => {
        throw new Error('download failed')
      })
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.mp3')
      await user.click(screen.getByRole('button', { name: 'g.downloadAudio' }))

      expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain(
        'error'
      )

      vi.mocked(downloadFile).mockReset()
    })
  })
})
