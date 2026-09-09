import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'

import CompactAgentComposer from './CompactAgentComposer.vue'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

describe('CompactAgentComposer', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    useAgentPanelStore().enabled = true
  })

  it('queues Enter submissions on the canvas without opening the full panel', async () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox', {
      name: i18n.global.t('agent.compactComposer.label')
    })

    await userEvent.type(textbox, 'Build a portrait workflow{Enter}')

    expect(useAgentComposerStore().pendingSubmission?.text).toBe(
      'Build a portrait workflow'
    )
    expect(useAgentComposerStore().compactSessionPhase).toBe('queued')
    expect(useAgentPanelStore().isOpen).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n.global.t('agent.compactComposer.building')
    )
  })

  it('does not submit an in-progress IME composition', async () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, '生成图片')

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true
    })
    textbox.dispatchEvent(enter)

    expect(enter.defaultPrevented).toBe(false)
    expect(useAgentComposerStore().pendingSubmission).toBeNull()
    expect(useAgentPanelStore().isOpen).toBe(false)
  })

  it('opens the full panel from its explicit control without submitting', async () => {
    render(CompactAgentComposer, {
      global: { plugins: [i18n] }
    })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.compactComposer.open')
      })
    )

    expect(useAgentPanelStore().isOpen).toBe(true)
  })

  it('keeps an unconsumed canvas request when the optional panel toggles', async () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')

    await userEvent.type(textbox, 'Retry this workflow{Enter}')
    useAgentPanelStore().open('compact_composer')
    useAgentPanelStore().close('close_button')

    expect(await screen.findByRole('textbox')).toBeDisabled()
    expect(useAgentComposerStore().pendingSubmission?.text).toBe(
      'Retry this workflow'
    )
    expect(useAgentComposerStore().compactSessionPhase).toBe('queued')
  })

  it('queues multiple reference files without opening the full panel', async () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const files = [
      new File(['dog'], 'dog.png', { type: 'image/png' }),
      new File(['sheep'], 'sheep.png', { type: 'image/png' })
    ]

    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-compact-file-input'),
      files
    )

    const requests = useAgentComposerStore().pendingAttachmentRequests
    expect(requests).toHaveLength(1)
    expect(requests[0]?.files.map(({ name }) => name)).toEqual([
      'dog.png',
      'sheep.png'
    ])
    expect(
      screen.getByRole('button', { name: i18n.global.t('agent.send') })
    ).toBeDisabled()
    expect(useAgentPanelStore().isOpen).toBe(false)
  })

  it('accepts attachable drops and claims unsupported file drops safely', () => {
    render(CompactAgentComposer, { global: { plugins: [i18n] } })
    const composer = screen.getByTestId('agent-compact-composer')
    const drop = (files: File[]) => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: { files, types: ['Files'] }
      })
      composer.dispatchEvent(event)
      return event
    }
    const unsupported = new File(['archive'], 'workflow.zip', {
      type: 'application/zip'
    })

    expect(drop([unsupported]).defaultPrevented).toBe(true)
    expect(useAgentComposerStore().pendingAttachmentRequests).toEqual([])

    const image = new File(['image'], 'reference.png', { type: 'image/png' })
    expect(drop([image]).defaultPrevented).toBe(true)
    expect(useAgentComposerStore().pendingAttachmentRequests[0]?.files).toEqual(
      [image]
    )
  })

  it('shows shared upload progress and blocks send until it settles', async () => {
    const store = useAgentComposerStore()
    store.draft = 'Animate these references'
    store.addAttachment({
      id: 'upload-1',
      name: 'dog.png',
      ref: '',
      uploading: true
    })
    render(CompactAgentComposer, { global: { plugins: [i18n] } })

    expect(screen.getByText('dog.png')).toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.global.t('agent.uploading'))
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: i18n.global.t('agent.send') })
    ).toBeDisabled()

    store.updateAttachment('upload-1', {
      ref: 'uploaded_dog.png',
      uploading: false
    })

    expect(
      await screen.findByRole('button', { name: i18n.global.t('agent.send') })
    ).toBeEnabled()
  })
})
