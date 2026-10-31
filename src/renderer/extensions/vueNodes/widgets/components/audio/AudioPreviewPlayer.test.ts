import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'

vi.mock(import('@comfyorg/telemetry/reportError'))

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
        .mockRejectedValue(notSupported())
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
      expect(reportError).toHaveBeenCalledWith(
        expect.any(DOMException),
        expect.objectContaining({ errorType: 'error_playing_audio' })
      )
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          description: enMessages.g.audioPlaybackFailed
        })
      )
      expect(useToast().toasts).toHaveLength(1)
    })

    it('reloads a failed source before retrying', async () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined)
      const load = vi
        .spyOn(HTMLMediaElement.prototype, 'load')
        .mockImplementation(() => {})
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.ogg')
      load.mockClear()
      vi.spyOn(HTMLMediaElement.prototype, 'error', 'get').mockReturnValue(
        fromPartial<MediaError>({ code: 4 })
      )

      await user.click(screen.getByRole('button', { name: 'g.playPause' }))

      expect(load).toHaveBeenCalledTimes(1)
      expect(load.mock.invocationCallOrder[0]).toBeLessThan(
        play.mock.invocationCallOrder[0]
      )
    })

    it('follows a pause that came from outside the player', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(
        true
      )
      const user = userEvent.setup()

      const { container } = renderPlayer('http://example.com/audio.mp3')
      const button = screen.getByRole('button', { name: 'g.playPause' })
      await user.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the media element is hidden and exposes no role
      await fireEvent(container.querySelector('audio')!, new Event('pause'))

      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('shows the error toast when playback fails after it started', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      const user = userEvent.setup()

      const { container } = renderPlayer('http://example.com/audio.mp3')
      const button = screen.getByRole('button', { name: 'g.playPause' })
      await user.click(button)

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the media element is hidden and exposes no role
      await fireEvent.error(container.querySelector('audio')!)

      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(useToast().toasts).toHaveLength(1)
    })

    it('dismisses the error toast when a retry is paused', async () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockRejectedValueOnce(notSupported())
        .mockImplementationOnce(() => new Promise<void>(() => {}))
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
      const user = userEvent.setup()

      renderPlayer('http://example.com/audio.mp3')
      const button = screen.getByRole('button', { name: 'g.playPause' })
      await user.click(button)
      expect(useToast().toasts).toHaveLength(1)

      await user.click(button)
      await user.click(button)

      expect(play).toHaveBeenCalledTimes(2)
      expect(useToast().toasts).toEqual([])
    })

    it('resets the shown time when the source is cleared', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(
        90
      )

      const { container, rerender } = renderPlayer(
        'http://example.com/audio.mp3'
      )
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the media element is hidden and exposes no role
      await fireEvent.loadedMetadata(container.querySelector('audio')!)
      expect(screen.getByText(/1:30/)).toBeInTheDocument()

      await rerender({ modelValue: undefined })

      expect(screen.queryByText(/1:30/)).not.toBeInTheDocument()
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

    it('pauses the still-attached element when the default player hides on clear', async () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      const connectedAtPause: boolean[] = []
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
        function (this: HTMLMediaElement) {
          connectedAtPause.push(this.isConnected)
        }
      )
      const user = userEvent.setup()

      const { rerender } = render(AudioPreviewPlayer, {
        props: { modelValue: 'http://example.com/audio.mp3' },
        global: { plugins: [i18n] }
      })
      await user.click(screen.getByRole('button', { name: 'g.playPause' }))
      connectedAtPause.length = 0

      await rerender({ modelValue: undefined })

      expect(connectedAtPause).toEqual([true])
      expect(
        screen.queryByRole('button', { name: 'g.playPause' })
      ).not.toBeInTheDocument()
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
      expect(reportError).not.toHaveBeenCalled()
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
      expect(reportError).not.toHaveBeenCalled()
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
