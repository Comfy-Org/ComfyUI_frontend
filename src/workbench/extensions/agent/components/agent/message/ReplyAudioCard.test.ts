import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'

import type { ReplyAsset } from '../../../utils/replyAssets'
import ReplyAudioCard from './ReplyAudioCard.vue'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

vi.mock(import('@/scripts/api'))
const fetchApi = vi.mocked(api.fetchApi)

const isAssetPreviewSupported = vi.hoisted(() => vi.fn(() => false))
const findOutputAsset = vi.hoisted(() =>
  vi.fn(async (): Promise<{ name: string } | undefined> => undefined)
)
vi.mock<unknown>(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported,
  findOutputAsset
}))

const asset: ReplyAsset = {
  url: 'http://x/api/view?filename=song.mp3',
  filename: 'song.mp3',
  kind: 'audio'
}

function renderCard() {
  return render(ReplyAudioCard, {
    props: { asset, title: 'qa_audio_opus_00001' },
    global: { plugins: [i18n] }
  })
}

function audioElement(): HTMLAudioElement {
  const element = screen.getByTestId('reply-audio-element')
  if (!(element instanceof HTMLAudioElement)) {
    throw new Error('audio element missing')
  }
  return element
}

describe('ReplyAudioCard', () => {
  let anchorClick: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((route) => `http://x/api${route}`)
    fetchApi.mockReset().mockResolvedValue(new Response(new Blob(['x'])))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    isAssetPreviewSupported.mockReset().mockReturnValue(false)
    findOutputAsset.mockReset().mockResolvedValue(undefined)
  })

  it('shows the title and a time readout without fetching the audio', () => {
    renderCard()

    expect(screen.getByText('qa_audio_opus_00001')).toBeInTheDocument()
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('starts playback from the play button', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(play).toHaveBeenCalledTimes(1)
    play.mockRestore()
  })

  it('mutes and unmutes the audio element', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(audioElement().muted).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(audioElement().muted).toBe(false)
  })

  it('seeks the audio position when the slider is scrubbed', async () => {
    renderCard()
    const audio = audioElement()
    Object.defineProperty(audio, 'duration', { value: 120 })
    await waitFor(() => {
      audio.dispatchEvent(new Event('durationchange'))
      expect(screen.getByText('0:00 / 2:00')).toBeInTheDocument()
    })

    const slider = await screen.findByRole('slider')
    slider.focus()
    await userEvent.keyboard('{PageUp>50}')

    expect(await screen.findByText('1:00 / 2:00')).toBeInTheDocument()
  })

  it('downloads the asset through the api route', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
    expect(anchorClick.mock.instances[0].download).toBe('song.mp3')
    expect(fetchApi).toHaveBeenCalledWith('/view?filename=song.mp3')
  })

  it('downloads under the resolved display name instead of the hash', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findOutputAsset.mockResolvedValue({ name: 'qa_audio_mp3_00001' })
    fetchApi.mockResolvedValue(
      new Response(new Blob(['x']), {
        headers: {
          'Content-Disposition': 'attachment; filename="storage-hash.mp3"'
        }
      })
    )
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
    expect(anchorClick.mock.instances[0].download).toBe(
      'qa_audio_mp3_00001.mp3'
    )
    expect(findOutputAsset).toHaveBeenCalledWith('song.mp3')
  })

  it('reports a rejected download and allows retry', async () => {
    fetchApi
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(new Response(new Blob(['retry'])))
    renderCard()
    const download = screen.getByRole('button', { name: 'Download' })

    await userEvent.click(download)

    await waitFor(() =>
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: '1 download failed'
        })
      )
    )

    await userEvent.click(download)

    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(2))
    expect(anchorClick).toHaveBeenCalledOnce()
  })
})
