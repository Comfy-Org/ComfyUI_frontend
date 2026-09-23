import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import RecordMenuControl from '@/components/load3d/menubar/RecordMenuControl.vue'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

type Props = {
  isRecording?: boolean
  hasRecording?: boolean
  recordingDuration?: number
  onStartRecording?: () => void
  onStopRecording?: () => void
  onExportRecording?: () => void
  onClearRecording?: () => void
}

function renderControl(props: Props = {}) {
  const result = render(RecordMenuControl, {
    props,
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup() }
}

async function openRecordingMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Video recording of the scene [mp4]' })
  )
}

describe('RecordMenuControl', () => {
  it('starts recording when idle', async () => {
    const onStartRecording = vi.fn()
    const { user } = renderControl({ isRecording: false, onStartRecording })

    await user.click(screen.getByRole('button', { name: 'Record' }))

    expect(onStartRecording).toHaveBeenCalledOnce()
  })

  it('stops recording when active', async () => {
    const onStopRecording = vi.fn()
    const { user } = renderControl({ isRecording: true, onStopRecording })

    await user.click(screen.getByRole('button', { name: 'Stop recording' }))

    expect(onStopRecording).toHaveBeenCalledOnce()
  })

  it('shows the recording duration once a recording exists', () => {
    renderControl({
      isRecording: false,
      hasRecording: true,
      recordingDuration: 65
    })

    expect(screen.getByText('01:05')).toBeInTheDocument()
  })

  it('downloads the recording from the menu', async () => {
    const onExportRecording = vi.fn()
    const { user } = renderControl({
      hasRecording: true,
      recordingDuration: 4,
      onExportRecording
    })

    await openRecordingMenu(user)
    await user.click(screen.getByRole('button', { name: 'Download Recording' }))

    expect(onExportRecording).toHaveBeenCalledOnce()
  })

  it('starts a new recording from the menu', async () => {
    const onStartRecording = vi.fn()
    const { user } = renderControl({
      hasRecording: true,
      recordingDuration: 4,
      onStartRecording
    })

    await openRecordingMenu(user)
    await user.click(
      screen.getByRole('button', { name: 'Start New Recording' })
    )

    expect(onStartRecording).toHaveBeenCalledOnce()
  })

  it('deletes the recording from the menu', async () => {
    const onClearRecording = vi.fn()
    const { user } = renderControl({
      hasRecording: true,
      recordingDuration: 4,
      onClearRecording
    })

    await openRecordingMenu(user)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete Recording'
      })
    )

    expect(onClearRecording).toHaveBeenCalledOnce()
  })

  it('deletes the recording via the chip dismiss button', async () => {
    const onClearRecording = vi.fn()
    const { user } = renderControl({
      hasRecording: true,
      recordingDuration: 4,
      onClearRecording
    })

    await user.click(screen.getByRole('button', { name: 'Delete Recording' }))

    expect(onClearRecording).toHaveBeenCalledOnce()
  })

  it('shows only the stop control while recording is in progress', () => {
    renderControl({ isRecording: true, hasRecording: true })

    expect(
      screen.queryByRole('button', {
        name: 'Video recording of the scene [mp4]'
      })
    ).not.toBeInTheDocument()
  })
})
