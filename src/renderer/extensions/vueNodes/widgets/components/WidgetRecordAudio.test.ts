/* eslint-disable vue/no-reserved-component-names */
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

type MockRecorderState = {
  isRecording: ReturnType<typeof ref<boolean>>
  recordedURL: ReturnType<typeof ref<string | null>>
  startRecording: ReturnType<typeof vi.fn>
  stopRecording: ReturnType<typeof vi.fn>
  mediaRecorder: ReturnType<typeof ref<unknown>>
}
type MockPlaybackState = {
  isPlaying: ReturnType<typeof ref<boolean>>
  audioElementKey: ReturnType<typeof ref<number>>
  resetAudioElement: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  getCurrentTime: ReturnType<typeof vi.fn>
  getDuration: ReturnType<typeof vi.fn>
  playbackTimerInterval: ReturnType<typeof ref<number | null>>
  onPlaybackEnded: ReturnType<typeof vi.fn>
  onMetadataLoaded: ReturnType<typeof vi.fn>
}

const recorderState = vi.hoisted(() => ({} as Record<string, unknown>))
const playbackState = vi.hoisted(() => ({} as Record<string, unknown>))
const waveformState = vi.hoisted(() => ({} as Record<string, unknown>))

vi.mock('../composables/audio/useAudioRecorder', () => ({
  useAudioRecorder: () => recorderState
}))

vi.mock('../composables/audio/useAudioPlayback', () => ({
  useAudioPlayback: () => playbackState
}))

vi.mock('../composables/audio/useAudioWaveform', () => ({
  useAudioWaveform: () => waveformState
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById: () => null } } }
}))

vi.mock('@/scripts/domWidget', () => ({
  isDOMWidget: () => false
}))

import WidgetRecordAudio from './WidgetRecordAudio.vue'

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

let recorder: MockRecorderState
let playback: MockPlaybackState

function setRecorderMocks(overrides: Partial<MockRecorderState> = {}) {
  recorder = {
    isRecording: ref(false),
    recordedURL: ref<string | null>(null),
    startRecording: vi.fn(async () => {}),
    stopRecording: vi.fn(),
    mediaRecorder: ref(null),
    ...overrides
  } as MockRecorderState
  Object.keys(recorderState).forEach((k) => delete recorderState[k])
  Object.assign(recorderState, recorder)
}

function setPlaybackMocks(overrides: Partial<MockPlaybackState> = {}) {
  playback = {
    isPlaying: ref(false),
    audioElementKey: ref(0),
    resetAudioElement: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    stop: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    playbackTimerInterval: ref<number | null>(null),
    onPlaybackEnded: vi.fn(),
    onMetadataLoaded: vi.fn(),
    ...overrides
  } as MockPlaybackState
  Object.keys(playbackState).forEach((k) => delete playbackState[k])
  Object.assign(playbackState, playback)
}

function setWaveformMocks() {
  const waveform = {
    waveformBars: ref<{ height: number }[]>([]),
    initWaveform: vi.fn(),
    stopWaveform: vi.fn(),
    dispose: vi.fn(),
    setupAudioContext: vi.fn(async () => {}),
    setupRecordingVisualization: vi.fn(async () => {}),
    setupPlaybackVisualization: vi.fn(async () => true),
    updateWaveform: vi.fn()
  }
  Object.keys(waveformState).forEach((k) => delete waveformState[k])
  Object.assign(waveformState, waveform)
}

function renderWidget(props: { readonly?: boolean; nodeId?: string } = {}) {
  return render(WidgetRecordAudio, {
    global: {
      plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
      stubs: { Button: ButtonStub }
    },
    props: { readonly: false, nodeId: 'n1', ...props }
  })
}

describe('WidgetRecordAudio', () => {
  beforeEach(() => {
    setRecorderMocks()
    setPlaybackMocks()
    setWaveformMocks()
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
      await user.click(
        screen.getByRole('button', { name: /Start Recording/i })
      )
      expect(recorder.startRecording).toHaveBeenCalledTimes(1)
    })

    it('does not start recording when readonly', async () => {
      renderWidget({ readonly: true })
      const user = userEvent.setup()
      const btn = screen.getByRole('button', { name: /Start Recording/i })
      await user.click(btn).catch(() => {})
      expect(recorder.startRecording).not.toHaveBeenCalled()
    })
  })

  describe('Recording state', () => {
    it('shows "Listening..." text while recording', () => {
      setRecorderMocks({ isRecording: ref(true) })
      renderWidget()
      expect(screen.getByText('Listening...')).toBeInTheDocument()
    })

    it('renders a stop button while recording', () => {
      setRecorderMocks({ isRecording: ref(true) })
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Stop Recording/i })
      ).toBeInTheDocument()
    })

    it('calls stopRecording when the stop button is clicked', async () => {
      setRecorderMocks({ isRecording: ref(true) })
      renderWidget()
      const user = userEvent.setup()
      await user.click(
        screen.getByRole('button', { name: /Stop Recording/i })
      )
      expect(recorder.stopRecording).toHaveBeenCalledTimes(1)
    })

    it('disables the Start Recording button while recording', () => {
      setRecorderMocks({ isRecording: ref(true) })
      renderWidget()
      expect(
        screen.getByRole('button', { name: /Start Recording/i })
      ).toBeDisabled()
    })
  })

  describe('Ready state (has recording, not playing)', () => {
    beforeEach(() => {
      setRecorderMocks({ recordedURL: ref('blob:fake-url') })
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
      setRecorderMocks({ recordedURL: ref('blob:fake-url') })
      setPlaybackMocks({ isPlaying: ref(true) })
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
      await user.click(
        screen.getByRole('button', { name: /Stop Playback/i })
      )
      expect(playback.stop).toHaveBeenCalledTimes(1)
    })
  })
})
