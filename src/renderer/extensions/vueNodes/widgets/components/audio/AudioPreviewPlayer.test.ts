import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'

const mockToastAdd = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('@/base/common/downloadUtil', () => ({
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

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error'
        })
      )

      vi.mocked(downloadFile).mockReset()
    })
  })
})
