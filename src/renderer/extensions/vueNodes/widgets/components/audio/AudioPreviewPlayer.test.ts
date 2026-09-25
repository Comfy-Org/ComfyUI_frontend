import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast'
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'

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
      hideWhenEmpty: false,
      showOptionsButton: true
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
}

describe('AudioPreviewPlayer', () => {
  it('changes playback speed through the options menu', async () => {
    renderPlayer('http://example.com/audio.mp3')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'g.moreOptions' }))
    const speedMenu = await screen.findByRole('menuitem', {
      name: 'g.playbackSpeed'
    })
    expect(
      within(speedMenu).getByTestId('menu-item-submenu-indicator')
    ).toBeVisible()
    await user.keyboard('{ArrowDown}{ArrowRight}{End}')
    const doubleSpeed = await screen.findByRole('menuitemradio', {
      name: 'g.2x'
    })
    await waitFor(() => expect(doubleSpeed).toHaveFocus())
    await user.keyboard('{Enter}')

    await user.click(screen.getByRole('button', { name: 'g.moreOptions' }))
    await user.keyboard('{ArrowDown}{ArrowRight}')
    expect(
      await screen.findByRole('menuitemradio', { name: 'g.2x' })
    ).toBeChecked()
    expect(
      screen.getByRole('menuitemradio', { name: 'g.1x' })
    ).not.toBeChecked()
  })

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

      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error'
        })
      )
    })
  })
})
