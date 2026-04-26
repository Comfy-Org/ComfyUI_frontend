/* eslint-disable vue/no-reserved-component-names */
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

const { useAudioRecorderMock, useAudioPlaybackMock, useAudioWaveformMock } =
  vi.hoisted(() => ({
    useAudioRecorderMock: vi.fn(),
    useAudioPlaybackMock: vi.fn(),
    useAudioWaveformMock: vi.fn()
  }))
const appMock = vi.hoisted(() => ({
  app: {
    canvas: {
      graph: {
        getNodeById: vi.fn<(id: string) => unknown>(() => null)
      }
    }
  }
}))
const isDOMWidgetMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('../composables/audio/useAudioRecorder', () => ({
  useAudioRecorder: useAudioRecorderMock
}))

vi.mock('../composables/audio/useAudioPlayback', () => ({
  useAudioPlayback: useAudioPlaybackMock
}))

vi.mock('../composables/audio/useAudioWaveform', () => ({
  useAudioWaveform: useAudioWaveformMock
}))

vi.mock('@/scripts/app', () => appMock)

vi.mock('@/scripts/domWidget', () => ({
  isDOMWidget: isDOMWidgetMock
}))

import type { useAudioPlayback } from '../composables/audio/useAudioPlayback'
import { useAudioRecorder } from '../composables/audio/useAudioRecorder'
import type { useAudioWaveform } from '../composables/audio/useAudioWaveform'
import WidgetRecordAudio from './WidgetRecordAudio.vue'

type RecorderOptions = NonNullable<Parameters<typeof useAudioRecorder>[0]>

const recorder = {
  isRecording: ref(false),
  recordedURL: ref<string | null>(null),
  mediaRecorder: ref<MediaRecorder | null>(null),
  startRecording: vi.fn(async () => {}),
  stopRecording: vi.fn(),
  dispose: vi.fn()
} satisfies ReturnType<typeof useAudioRecorder>

const playback = {
  isPlaying: ref(false),
  audioElementKey: ref(0),
  play: vi.fn(async () => true),
  stop: vi.fn(),
  onPlaybackEnded: vi.fn(),
  onMetadataLoaded: vi.fn(),
  resetAudioElement: vi.fn(async () => {}),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 0),
  playbackTimerInterval: ref<ReturnType<typeof setInterval> | null>(null)
} satisfies ReturnType<typeof useAudioPlayback>

const waveform = {
  waveformBars: ref<{ height: number }[]>([]),
  initWaveform: vi.fn(),
  updateWaveform: vi.fn(),
  setupAudioContext: vi.fn(async () => {}),
  setupRecordingVisualization: vi.fn(async () => {}),
  setupPlaybackVisualization: vi.fn(async () => true),
  stopWaveform: vi.fn(),
  dispose: vi.fn()
} satisfies ReturnType<typeof useAudioWaveform>

useAudioRecorderMock.mockImplementation(() => recorder)
useAudioPlaybackMock.mockImplementation(() => playback)
useAudioWaveformMock.mockImplementation(() => waveform)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        startRecording: 'Start Recording',
        stopRecording: 'Stop Recording',
        playRecording: 'Play Recording',
        stopPlayback: 'Stop Playback',
        listening: 'Listening...',
        playing: 'Playing...',
        ready: 'Ready',
        micPermissionDenied: 'Microphone permission denied'
      }
    }
  }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  props: { disabled: { type: Boolean, default: false } },
  template:
    '<button v-bind="$attrs" :disabled="disabled" type="button"><slot /></button>'
})

function renderWidget(props: { readonly?: boolean; nodeId?: string } = {}) {
  return render(WidgetRecordAudio, {
    global: {
      plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
      stubs: { Button: ButtonStub }
    },
    props: { readonly: false, nodeId: 'n1', ...props }
  })
}

function getRecorderOptions(): RecorderOptions {
  const options = vi.mocked(useAudioRecorder).mock.calls.at(-1)?.[0]
  if (!options) throw new Error('useAudioRecorder has not been called yet')
  return options
}

describe('WidgetRecordAudio', () => {
  beforeEach(() => {
    recorder.isRecording.value = false
    recorder.recordedURL.value = null
    recorder.mediaRecorder.value = null
    recorder.startRecording.mockClear()
    recorder.stopRecording.mockClear()
    recorder.dispose.mockClear()

    playback.isPlaying.value = false
    playback.audioElementKey.value = 0
    playback.playbackTimerInterval.value = null
    playback.play.mockClear()
    playback.stop.mockClear()

    waveform.waveformBars.value = []

    useAudioRecorderMock.mockClear()
    useAudioPlaybackMock.mockClear()
    useAudioWaveformMock.mockClear()

    appMock.app.canvas.graph.getNodeById.mockReset().mockReturnValue(null)
    isDOMWidgetMock.mockReset().mockReturnValue(false)
  })

  describe('Idle state', () => {
    it('renders the Start Recording button', () => {
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Start Recording/i })
      ).toBeInTheDocument()
    })

    it('does not render status area when idle', () => {
      renderWidget()
      expect(screen.queryByText('Listening...')).toBeNull()
      expect(screen.queryByText('Ready')).toBeNull()
    })

    it('disables the Start Recording button when readonly is true', () => {
      renderWidget({ readonly: true })
      expect(
        screen.getByRole('button', { name: /Start Recording/i })
      ).toBeDisabled()
    })

    it('calls startRecording when Start button is clicked', async () => {
      renderWidget()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Start Recording/i }))
      expect(recorder.startRecording).toHaveBeenCalledTimes(1)
    })

    it('does not start recording when readonly', async () => {
      renderWidget({ readonly: true })
      const user = userEvent.setup()
      const btn = screen.getByRole('button', { name: /Start Recording/i })
      await user.click(btn)
      expect(recorder.startRecording).not.toHaveBeenCalled()
    })
  })

  describe('Recording state', () => {
    beforeEach(() => {
      recorder.isRecording.value = true
    })

    it('shows "Listening..." text while recording', () => {
      renderWidget()
      expect(screen.getByText('Listening...')).toBeInTheDocument()
    })

    it('renders a stop button while recording', () => {
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Stop Recording/i })
      ).toBeInTheDocument()
    })

    it('calls stopRecording when the stop button is clicked', async () => {
      renderWidget()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Stop Recording/i }))
      expect(recorder.stopRecording).toHaveBeenCalledTimes(1)
    })

    it('disables the Start Recording button while recording', () => {
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Start Recording/i })
      ).toBeDisabled()
    })
  })

  describe('Ready state (has recording, not playing)', () => {
    beforeEach(() => {
      recorder.recordedURL.value = 'blob:fake-url'
    })

    it('shows "Ready" text', () => {
      renderWidget()
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })

    it('renders the play button', () => {
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Play Recording/i })
      ).toBeInTheDocument()
    })
  })

  describe('Playing state', () => {
    beforeEach(() => {
      recorder.recordedURL.value = 'blob:fake-url'
      playback.isPlaying.value = true
    })

    it('shows "Playing..." text', () => {
      renderWidget()
      expect(screen.getByText('Playing...')).toBeInTheDocument()
    })

    it('renders the stop playback button', () => {
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Stop Playback/i })
      ).toBeInTheDocument()
    })

    it('calls playback.stop when the stop playback button is clicked', async () => {
      renderWidget()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Stop Playback/i }))
      expect(playback.stop).toHaveBeenCalledTimes(1)
    })
  })

  describe('Recording persistence via onRecordingComplete', () => {
    function createAudioWidget(initialSrc = '') {
      const element = document.createElement('audio') as HTMLAudioElement
      element.src = initialSrc
      return {
        name: 'audioUI',
        type: 'audio',
        element
      }
    }

    function primeAudioWidgetInNode(widgets: { element: HTMLAudioElement }[]) {
      appMock.app.canvas.graph.getNodeById.mockReturnValue({ widgets })
      isDOMWidgetMock.mockReturnValue(true)
    }

    beforeEach(() => {
      vi.spyOn(URL, 'createObjectURL').mockImplementation(
        (blob: Blob | MediaSource) =>
          blob instanceof Blob ? `blob:fake/${blob.size}` : 'blob:fake/media'
      )
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.mocked(URL.createObjectURL).mockRestore()
      vi.mocked(URL.revokeObjectURL).mockRestore()
    })

    it('replaces the audio widget element src with a new blob URL when a recording completes', async () => {
      const audioWidget = createAudioWidget()
      primeAudioWidgetInNode([audioWidget])
      renderWidget()

      const blob = new Blob(['audio-bytes'], { type: 'audio/webm' })
      await getRecorderOptions().onRecordingComplete?.(blob)

      expect(audioWidget.element.src).toContain('blob:fake/')
    })

    it('revokes the previous blob URL before replacing it', async () => {
      vi.mocked(URL.createObjectURL).mockReturnValue('blob:fake/new')

      const audioWidget = createAudioWidget('blob:stale-existing')
      primeAudioWidgetInNode([audioWidget])
      renderWidget()

      await getRecorderOptions().onRecordingComplete?.(new Blob(['x']))

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stale-existing')
      expect(audioWidget.element.src).toBe('blob:fake/new')
    })

    it('does not write to non-DOM widgets on the host node', async () => {
      vi.mocked(URL.createObjectURL).mockReturnValue('blob:fake/new')

      const audioWidget = createAudioWidget('originally-empty')
      primeAudioWidgetInNode([audioWidget])
      isDOMWidgetMock.mockReturnValue(false)
      renderWidget()

      await getRecorderOptions().onRecordingComplete?.(new Blob(['x']))

      expect(audioWidget.element.src).not.toBe('blob:fake/new')
    })
  })
})
