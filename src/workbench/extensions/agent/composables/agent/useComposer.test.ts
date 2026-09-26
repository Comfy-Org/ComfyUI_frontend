import { assert, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { AgentStarterPromptAttribution } from '../../utils/starterPrompts'
import type { ComposerAttachment } from './useComposer'
import { useComposer } from './useComposer'

vi.mock(import('@/platform/telemetry'))
const telemetryProvider = useTelemetry()
assert.exists(telemetryProvider)
const telemetry = vi.mocked(telemetryProvider)

const CHIP: AgentStarterPromptAttribution = {
  promptId: 'list_workflows',
  promptIndex: 1,
  promptCount: 5,
  promptTextHash: 'deadbeef',
  locale: 'en'
}

function setup(running = false) {
  const onSend =
    vi.fn<(text: string, attachments: ComposerAttachment[]) => void>()
  const onStop = vi.fn()
  const composer = useComposer({
    onSend,
    onStop,
    isRunning: () => running
  })
  return { composer, onSend, onStop }
}

describe('useComposer', () => {
  it('requests submission with trimmed text while retaining the editable draft', () => {
    const { composer, onSend } = setup()
    const attachment: ComposerAttachment = {
      id: 'a1',
      name: 'cat.png',
      ref: 'uploaded_cat.png'
    }
    composer.setText('  make a cat  ')
    composer.addAttachment(attachment)

    composer.submit()

    expect(onSend).toHaveBeenCalledWith('make a cat  @[Image: cat.png]', [
      attachment
    ])
    expect(composer.draft.value).toBe('  make a cat   ')
    expect(composer.attachments.value).toEqual([attachment])
  })

  it('blocks send while any attachment is uploading, unblocks on settle', () => {
    const { composer, onSend } = setup()
    composer.setText('wire it in')
    composer.addAttachment({
      id: 'u1',
      name: 'cat.png',
      ref: '',
      uploading: true
    })

    expect(composer.canSend.value).toBe(false)
    composer.submit()
    expect(onSend).not.toHaveBeenCalled()

    composer.updateAttachment('u1', {
      ref: 'uploaded_cat.png',
      uploading: false
    })
    expect(composer.canSend.value).toBe(true)
  })

  it('revokes a dismissed blob preview but never a submitted one', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { composer } = setup()
    composer.addAttachment({
      id: 'a1',
      name: 'a.png',
      ref: 'r1',
      previewUrl: 'blob:a'
    })
    composer.removeAttachment('a1')
    expect(revoke).toHaveBeenCalledWith('blob:a')

    revoke.mockClear()
    composer.setText('send it')
    composer.addAttachment({
      id: 'a2',
      name: 'b.png',
      ref: 'r2',
      previewUrl: 'blob:b'
    })
    composer.submit()
    expect(revoke).not.toHaveBeenCalled()
    revoke.mockRestore()
  })

  it('allows an attachment-only send with empty text', () => {
    const { composer, onSend } = setup()
    composer.addAttachment({ id: 'a1', name: 'cat.png', ref: 'r' })

    expect(composer.canSend.value).toBe(true)
    composer.submit()

    expect(onSend).toHaveBeenCalledWith('@[Image: cat.png]', [
      { id: 'a1', name: 'cat.png', ref: 'r' }
    ])
  })

  it('does not send when there is neither text nor an attachment', () => {
    const { composer, onSend } = setup()
    composer.setText('   ')

    expect(composer.canSend.value).toBe(false)
    composer.submit()

    expect(onSend).not.toHaveBeenCalled()
  })

  it('routes submit to stop while running, without sending', () => {
    const { composer, onSend, onStop } = setup(true)
    composer.setText('ignored while streaming')

    composer.submit()

    expect(onStop).toHaveBeenCalledOnce()
    expect(onSend).not.toHaveBeenCalled()
    expect(composer.draft.value).toBe('ignored while streaming')
  })

  it('insert appends to the draft without sending', () => {
    const { composer, onSend } = setup()
    composer.insert('first')
    composer.insert('second')

    expect(composer.draft.value).toBe('first second')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('attributes an inserted suggestion chip to the suggestion origin', () => {
    const { composer } = setup()
    const store = useAgentComposerStore()
    expect(store.promptOrigin).toBe('typed')

    composer.insert('Upscale this image')

    expect(store.promptOrigin).toBe('suggestion')
  })

  it('reports one starter prompt click per identified insert', () => {
    const { composer } = setup()
    const store = useAgentComposerStore()

    composer.insert('List my saved workflows', CHIP)

    expect(telemetry.trackAgentStarterPromptClicked).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentStarterPromptClicked).toHaveBeenCalledWith({
      prompt_id: 'list_workflows',
      prompt_index: 1,
      prompt_count: 5,
      prompt_text_hash: 'deadbeef',
      locale: 'en',
      click_id: expect.any(String),
      draft_was_empty: true
    })
    // The id on the event is the id the send will be attributed with.
    const [[event]] = telemetry.trackAgentStarterPromptClicked.mock.calls
    expect(store.starterPrompt).toEqual({
      id: 'list_workflows',
      clickId: event.click_id
    })
  })

  it('marks a second click as landing on a draft that was not empty', () => {
    const { composer } = setup()

    composer.insert('List my saved workflows', CHIP)
    composer.insert('Explain the selected node', {
      ...CHIP,
      promptId: 'explain_selected_node',
      promptIndex: 3
    })

    const calls = telemetry.trackAgentStarterPromptClicked.mock.calls
    expect(calls.map(([event]) => event.draft_was_empty)).toEqual([true, false])
    expect(calls[0][0].click_id).not.toBe(calls[1][0].click_id)
    // Appending means the last chip owns the draft, and the text is a mix.
    expect(composer.draft.value).toBe(
      'List my saved workflows Explain the selected node'
    )
  })

  it('reports no click when the affordance does not identify a prompt', () => {
    const { composer } = setup()
    const store = useAgentComposerStore()

    composer.insert('Upscale this image')

    expect(telemetry.trackAgentStarterPromptClicked).not.toHaveBeenCalled()
    expect(store.promptOrigin).toBe('suggestion')
    expect(store.starterPrompt).toBeNull()
  })

  it('does not leave a previous chip attributed to an unidentified insert', () => {
    const { composer } = setup()
    const store = useAgentComposerStore()

    composer.insert('List my saved workflows', CHIP)
    composer.insert('something else entirely')

    expect(store.starterPrompt).toBeNull()
  })

  it('a recreated composer rehydrates the pending draft and attachments', () => {
    const first = setup().composer
    first.setText('still here')
    first.addAttachment({ id: 'a1', name: 'cat.png', ref: 'r' })

    const { composer: second, onSend } = setup()
    expect(second.draft.value).toBe('still here ')
    expect(second.attachments.value.map((a) => a.id)).toEqual(['a1'])

    second.submit()
    expect(onSend).toHaveBeenCalledWith('still here@[Image: cat.png]', [
      { id: 'a1', name: 'cat.png', ref: 'r' }
    ])
    expect(first.draft.value).toBe('still here ')
    expect(first.attachments.value.map((attachment) => attachment.id)).toEqual([
      'a1'
    ])
  })

  it('removeAttachment drops the matching staged attachment', () => {
    const { composer } = setup()
    composer.addAttachment({ id: 'a1', name: 'a.png', ref: 'ra' })
    composer.addAttachment({ id: 'a2', name: 'b.png', ref: 'rb' })

    composer.removeAttachment('a1')

    expect(composer.attachments.value.map((a) => a.id)).toEqual(['a2'])
  })
})
