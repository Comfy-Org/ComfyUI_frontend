import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import RecordingControls from '@/components/load3d/controls/RecordingControls.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        startRecording: 'Start recording',
        stopRecording: 'Stop recording',
        exportRecording: 'Export recording',
        clearRecording: 'Clear recording'
      }
    }
  }
})

type RenderOpts = {
  hasRecording?: boolean
  isRecording?: boolean
  recordingDuration?: number
  onStartRecording?: () => void
  onStopRecording?: () => void
  onExportRecording?: () => void
  onClearRecording?: () => void
}

function renderComponent(opts: RenderOpts = {}) {
  const hasRecording = ref<boolean>(opts.hasRecording ?? false)
  const isRecording = ref<boolean>(opts.isRecording ?? false)
  const recordingDuration = ref<number>(opts.recordingDuration ?? 0)

  const utils = render(RecordingControls, {
    props: {
      hasRecording: hasRecording.value,
      'onUpdate:hasRecording': (v: boolean | undefined) => {
        if (v !== undefined) hasRecording.value = v
      },
      isRecording: isRecording.value,
      'onUpdate:isRecording': (v: boolean | undefined) => {
        if (v !== undefined) isRecording.value = v
      },
      recordingDuration: recordingDuration.value,
      'onUpdate:recordingDuration': (v: number | undefined) => {
        if (v !== undefined) recordingDuration.value = v
      },
      onStartRecording: opts.onStartRecording,
      onStopRecording: opts.onStopRecording,
      onExportRecording: opts.onExportRecording,
      onClearRecording: opts.onClearRecording
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return { ...utils, user: userEvent.setup() }
}

describe('RecordingControls', () => {
  it('shows the start-recording button initially', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Start recording' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Stop recording' })
    ).not.toBeInTheDocument()
  })

  it('shows the stop-recording button while recording is in progress', () => {
    renderComponent({ isRecording: true })

    expect(
      screen.getByRole('button', { name: 'Stop recording' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start recording' })
    ).not.toBeInTheDocument()
  })

  it('emits startRecording when the button is clicked from a stopped state', async () => {
    const onStartRecording = vi.fn()
    const onStopRecording = vi.fn()
    const { user } = renderComponent({
      isRecording: false,
      onStartRecording,
      onStopRecording
    })

    await user.click(screen.getByRole('button', { name: 'Start recording' }))

    expect(onStartRecording).toHaveBeenCalledOnce()
    expect(onStopRecording).not.toHaveBeenCalled()
  })

  it('emits stopRecording when the button is clicked from a recording state', async () => {
    const onStartRecording = vi.fn()
    const onStopRecording = vi.fn()
    const { user } = renderComponent({
      isRecording: true,
      onStartRecording,
      onStopRecording
    })

    await user.click(screen.getByRole('button', { name: 'Stop recording' }))

    expect(onStopRecording).toHaveBeenCalledOnce()
    expect(onStartRecording).not.toHaveBeenCalled()
  })

  it('hides the export and clear buttons when there is no recording', () => {
    renderComponent({ hasRecording: false, isRecording: false })

    expect(
      screen.queryByRole('button', { name: 'Export recording' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Clear recording' })
    ).not.toBeInTheDocument()
  })

  it('shows the export and clear buttons once a recording exists', () => {
    renderComponent({ hasRecording: true, isRecording: false })

    expect(
      screen.getByRole('button', { name: 'Export recording' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear recording' })
    ).toBeInTheDocument()
  })

  it('hides the export and clear buttons during a new recording even if a previous one exists', () => {
    renderComponent({ hasRecording: true, isRecording: true })

    expect(
      screen.queryByRole('button', { name: 'Export recording' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Clear recording' })
    ).not.toBeInTheDocument()
  })

  it('emits exportRecording and clearRecording from their respective buttons', async () => {
    const onExportRecording = vi.fn()
    const onClearRecording = vi.fn()
    const { user } = renderComponent({
      hasRecording: true,
      isRecording: false,
      onExportRecording,
      onClearRecording
    })

    await user.click(screen.getByRole('button', { name: 'Export recording' }))
    await user.click(screen.getByRole('button', { name: 'Clear recording' }))

    expect(onExportRecording).toHaveBeenCalledOnce()
    expect(onClearRecording).toHaveBeenCalledOnce()
  })

  it('renders the formatted duration as MM:SS once a recording exists', () => {
    renderComponent({
      hasRecording: true,
      isRecording: false,
      recordingDuration: 75
    })

    expect(screen.getByTestId('load3d-recording-duration')).toHaveTextContent(
      '01:15'
    )
  })

  it('hides the duration display while a recording is in progress', () => {
    renderComponent({
      hasRecording: true,
      isRecording: true,
      recordingDuration: 30
    })

    expect(
      screen.queryByTestId('load3d-recording-duration')
    ).not.toBeInTheDocument()
  })

  it('hides the duration display when recordingDuration is zero', () => {
    renderComponent({
      hasRecording: true,
      isRecording: false,
      recordingDuration: 0
    })

    expect(
      screen.queryByTestId('load3d-recording-duration')
    ).not.toBeInTheDocument()
  })
})
