import { describe, expect, it, vi } from 'vitest'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPromptQueueStore } from '@/workbench/extensions/agent/stores/agent/agentPromptQueueStore'
import type { PromptQueueItem } from '@/workbench/extensions/agent/stores/agent/promptQueueState'

import { useAgentPromptQueue } from './useAgentPromptQueue'

function setup() {
  const busy = { value: false }
  const sent: string[] = []
  const deferred = vi.fn()
  const submitDraft = vi.fn((text: string) => {
    busy.value = true
    sent.push(text)
  })
  const sendItem = vi.fn(async (item: PromptQueueItem) => {
    busy.value = true
    sent.push(item.text)
  })
  const queueApi = useAgentPromptQueue({
    isBusy: () => busy.value,
    submitDraft,
    sendItem,
    deferCapture: deferred
  })
  return {
    busy,
    sent,
    deferred,
    ...queueApi,
    queue: useAgentPromptQueueStore(),
    composer: useAgentComposerStore()
  }
}

describe('useAgentPromptQueue', () => {
  it('sends queued follow-ups in order after the active turn finishes', async () => {
    const {
      busy,
      sent,
      handleComposerSend,
      settleActiveAndPump,
      composer,
      queue
    } = setup()
    composer.setText('one')
    handleComposerSend('one', [])
    composer.setText('two')
    handleComposerSend('two', [])
    composer.setText('three')
    handleComposerSend('three', [])

    expect(sent).toEqual(['one'])
    expect(queue.items.map((item) => item.text)).toEqual([
      'one',
      'two',
      'three'
    ])
    expect(composer.draft).toBe('')

    busy.value = false
    await settleActiveAndPump()
    expect(sent).toEqual(['one', 'two'])
    busy.value = false
    await settleActiveAndPump()
    expect(sent).toEqual(['one', 'two', 'three'])
    busy.value = false
    await settleActiveAndPump()
    expect(queue.count).toBe(0)
  })

  it('does not send the item being edited and resumes it after submit', async () => {
    const {
      busy,
      sent,
      handleComposerSend,
      settleActiveAndPump,
      composer,
      queue
    } = setup()
    composer.setText('one')
    handleComposerSend('one', [])
    composer.setText('two')
    handleComposerSend('two', [])
    composer.setText('three')
    handleComposerSend('three', [])
    composer.setText('unsent')

    expect(queue.startEdit(queue.items[1].id)).toBe(true)
    expect(queue.count).toBe(2)
    expect(composer.draft).toBe('two')

    busy.value = false
    await settleActiveAndPump()
    expect(sent).toEqual(['one', 'three'])
    expect(queue.items.map((item) => item.text)).toEqual(['three'])

    composer.setText('two revised')
    handleComposerSend('two revised', [])
    expect(composer.draft).toBe('unsent')
    expect(queue.items.map((item) => item.text)).toEqual([
      'three',
      'two revised'
    ])

    busy.value = false
    await settleActiveAndPump()
    expect(sent).toEqual(['one', 'three', 'two revised'])
  })
})
