import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { audioPlaybackFailed: enMessages.g.audioPlaybackFailed } }
  }
})

const notSupported = () =>
  new DOMException('The operation is not supported.', 'NotSupportedError')

function renderPlayer(modelValue?: string) {
  return render(AudioPreviewPlayer, {
    props: {
      modelValue,
      hideWhenEmpty: false,
      showOptionsButton: true
    },
    global: {
      plugins: [i18n]
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

  describe('play/pause button', () => {
    it('stays paused and shows a toast when Safari rejects playback with NotSupportedError', async () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockRejectedValue(
          new DOMException(
            'The operation is not supported.',
            'NotSupportedError'
          )
        )
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {})
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.ogg')
      pause.mockClear()
      const button = screen.getByRole('button', { name: 'g.playPause' })

      await user.click(button)
      await user.click(button)

      expect(play).toHaveBeenCalledTimes(2)
      expect(pause).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledWith(
        'Audio playback failed:',
        expect.any(DOMException)
      )
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          description: enMessages.g.audioPlaybackFailed
        })
      )
      expect(useToast().toasts).toHaveLength(1)
    })

    it('dismisses the playback error toast after a successful retry', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play')
        .mockRejectedValueOnce(notSupported())
        .mockResolvedValueOnce(undefined)
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.mp3')
      const button = screen.getByRole('button', { name: 'g.playPause' })

      await user.click(button)
      expect(useToast().toasts).toHaveLength(1)

      await user.click(button)
      expect(useToast().toasts).toEqual([])
    })

    it.for([
      ['replaced', 'http://example.com/other.mp3'],
      ['cleared', undefined]
    ] as const)(
      'ignores a pending rejection after the source is %s',
      async ([, nextSource]) => {
        const attempts: Array<(reason: unknown) => void> = []
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
          () =>
            new Promise<void>((_resolve, reject) => {
              attempts.push(reject)
            })
        )
        const user = userEvent.setup()

        const { rerender } = renderPlayer('http://example.com/audio.mp3')
        await user.click(screen.getByRole('button', { name: 'g.playPause' }))
        await rerender({ modelValue: nextSource })
        attempts[0](notSupported())
        await Promise.resolve()

        expect(useToast().toasts).toEqual([])
        expect(
          screen.getByRole('button', { name: 'g.playPause' })
        ).toHaveAttribute('aria-pressed', 'false')
      }
    )

    it('pauses the element when the source is cleared mid-playback', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {})
      const user = userEvent.setup()

      const { rerender } = renderPlayer('http://example.com/audio.mp3')
      const button = screen.getByRole('button', { name: 'g.playPause' })

      await user.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      pause.mockClear()

      await rerender({ modelValue: undefined })

      expect(pause).toHaveBeenCalledTimes(1)
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('ignores a pending rejection after unmount', async () => {
      const attempts: Array<(reason: unknown) => void> = []
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            attempts.push(reject)
          })
      )
      const user = userEvent.setup()

      const { unmount } = renderPlayer('http://example.com/audio.mp3')
      await user.click(screen.getByRole('button', { name: 'g.playPause' }))
      unmount()
      attempts[0](notSupported())
      await Promise.resolve()

      expect(useToast().toasts).toEqual([])
    })

    it('stays silent when the current play attempt is aborted', async () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockRejectedValue(new DOMException('Aborted', 'AbortError'))
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.mp3')
      const button = screen.getByRole('button', { name: 'g.playPause' })

      await user.click(button)
      await user.click(button)

      expect(play).toHaveBeenCalledTimes(2)
      expect(console.warn).not.toHaveBeenCalledWith(
        'Audio playback failed:',
        expect.anything()
      )
      expect(useToast().toasts).toEqual([])
    })

    it('ignores a rejection from a superseded play attempt', async () => {
      const attempts: Array<(reason: unknown) => void> = []
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(
          () =>
            new Promise<void>((_resolve, reject) => {
              attempts.push(reject)
            })
        )
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {})
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.mp3')
      pause.mockClear()
      const button = screen.getByRole('button', { name: 'g.playPause' })

      await user.click(button)
      await user.click(button)
      await user.click(button)
      attempts[0](new DOMException('Interrupted by pause', 'AbortError'))
      await user.click(button)

      expect(play).toHaveBeenCalledTimes(2)
      expect(pause).toHaveBeenCalledTimes(2)
      expect(console.warn).not.toHaveBeenCalledWith(
        'Audio playback failed:',
        expect.anything()
      )
      expect(useToast().toasts).toEqual([])
    })
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
