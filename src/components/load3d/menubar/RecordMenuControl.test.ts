import { render, screen } from '@testing-library/vue'
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

  it('exposes export, clear and duration once a recording exists', async () => {
    const onExportRecording = vi.fn()
    const onClearRecording = vi.fn()
    const { user } = renderControl({
      isRecording: false,
      hasRecording: true,
      recordingDuration: 65,
      onExportRecording,
      onClearRecording
    })

    expect(screen.getByText('01:05')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export Recording' }))
    await user.click(screen.getByRole('button', { name: 'Clear Recording' }))

    expect(onExportRecording).toHaveBeenCalledOnce()
    expect(onClearRecording).toHaveBeenCalledOnce()
  })

  it('hides export and clear while recording is in progress', () => {
    renderControl({ isRecording: true, hasRecording: true })

    expect(
      screen.queryByRole('button', { name: 'Export Recording' })
    ).not.toBeInTheDocument()
  })
})
