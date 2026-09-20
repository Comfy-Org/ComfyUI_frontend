import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import WaveAudioPlayer from './WaveAudioPlayer.vue'

const mockFetchApi = vi.fn()

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    apiURL: (route: string) => '/api' + route,
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
  }
}))

const SRC = 'https://example.com/a.wav'
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000]
const DURATION_SECONDS = 10
const SEEK_WIDTH_PX = 100

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const globalConfig = { plugins: [i18n] }

async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await nextTick()
  }
}

function renderPlayer(variant: 'compact' | 'expanded' = 'compact') {
  const utils = render(WaveAudioPlayer, {
    props: { src: SRC, variant },
    global: globalConfig
  })
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the media element is hidden and exposes no role
  const audio = utils.container.querySelector('audio')
  if (!audio) throw new Error('audio element missing')
  return { ...utils, audio }
}

async function stubPlayback(audio: HTMLAudioElement) {
  await settle()
  Object.defineProperty(audio, 'duration', {
    value: DURATION_SECONDS,
    configurable: true
  })
  audio.play = vi.fn(() => Promise.resolve())
  audio.pause = vi.fn(() => {})
  await fireEvent(audio, new Event('durationchange'))
  await settle()
}

async function clickSeekSurfaceMidpoint(testId: string) {
  const surface = screen.getByTestId(testId)
  surface.getBoundingClientRect = () => new DOMRect(0, 0, SEEK_WIDTH_PX, 32)
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.pointer({
    keys: '[MouseLeft]',
    target: surface,
    coords: { clientX: SEEK_WIDTH_PX / 2, clientY: 16 }
  })
}

async function exhaustRetries(audio: HTMLAudioElement) {
  for (const delay of RETRY_DELAYS_MS) {
    await fireEvent.error(audio)
    await vi.advanceTimersByTimeAsync(delay)
    await settle()
  }
  await fireEvent.error(audio)
  await settle()
}

describe('WaveAudioPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockFetchApi.mockRejectedValue(new Error('network down'))
  })

  it('binds the source to the hidden audio element', () => {
    const { audio } = renderPlayer()

    expect(audio).toHaveAttribute('src', SRC)
  })

  it('reloads the audio after a load error', async () => {
    const { audio } = renderPlayer()

    await fireEvent.error(audio)

    vi.advanceTimersByTime(RETRY_DELAYS_MS[0])
    await nextTick()
    expect(audio).not.toHaveAttribute('src')

    await settle()
    expect(audio).toHaveAttribute('src', SRC)
    expect(screen.getByRole('button', { name: 'g.play' })).toBeEnabled()
  })

  it('keeps playback interactive while healthy', async () => {
    const { audio } = renderPlayer()
    await stubPlayback(audio)

    expect(screen.getByRole('button', { name: 'g.play' })).toBeEnabled()

    await clickSeekSurfaceMidpoint('wave-audio-waveform')

    expect(screen.getByRole('button', { name: 'g.pause' })).toBeInTheDocument()
  })

  it('disables the compact controls once retries are exhausted', async () => {
    const { audio } = renderPlayer()
    await stubPlayback(audio)

    await exhaustRetries(audio)

    expect(screen.getByRole('button', { name: 'g.play' })).toBeDisabled()

    await clickSeekSurfaceMidpoint('wave-audio-waveform')

    expect(screen.getByRole('button', { name: 'g.play' })).toBeInTheDocument()
  })

  it('disables the expanded controls once retries are exhausted', async () => {
    const { audio, container } = renderPlayer('expanded')
    await stubPlayback(audio)

    await exhaustRetries(audio)

    expect(screen.getByRole('button', { name: 'g.play' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'g.skipToStart' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'g.skipToEnd' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'g.volume' })).toBeDisabled()
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- Reka exposes disabled state as a data attribute on the root
      container.querySelector('[data-slot="slider"]')
    ).toHaveAttribute('data-disabled')

    await clickSeekSurfaceMidpoint('wave-audio-progress')

    expect(screen.getByText('0:00')).toBeInTheDocument()
  })
})
