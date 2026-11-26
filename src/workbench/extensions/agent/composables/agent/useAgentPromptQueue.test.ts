import { describe, expect, it, vi } from 'vitest'

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({ reportError }))

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
    submitDraft,
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

  it('drops the running item when its send throws', async () => {
    const { handleComposerSend, queue, composer, submitDraft } = setup()
    const failure = new Error('send failed')
    submitDraft.mockImplementationOnce(() => Promise.reject(failure))
    composer.setText('one')
    handleComposerSend('one', [])

    await vi.waitFor(() => expect(queue.runningId).toBeNull())
    expect(queue.count).toBe(0)
    expect(reportError).toHaveBeenCalledWith(failure, {
      surface: 'agent',
      errorType: 'agent_send_message_failed'
    })
  })

  it('drops the running item when the first send fails so a retry can send', async () => {
    const { handleComposerSend, queue, composer, submitDraft } = setup()
    submitDraft.mockImplementationOnce(async () => false)

    composer.setText('one')
    handleComposerSend('one', [])
    await vi.waitFor(() => expect(queue.runningId).toBeNull())
    expect(queue.count).toBe(0)

    composer.setText('one')
    handleComposerSend('one', [])
    expect(submitDraft).toHaveBeenCalledTimes(2)
    expect(queue.runningId).not.toBeNull()
  })

  it('resumes the queue when an edit is cancelled after the active turn ended', async () => {
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
    expect(queue.startEdit(queue.items[1].id)).toBe(true)

    busy.value = false
    await settleActiveAndPump()
    expect(sent).toEqual(['one'])

    queue.cancelEdit()
    await vi.waitFor(() => expect(sent).toEqual(['one', 'two']))
  })

  it('sends the next prompt when a turn ends while a queued send is still settling', async () => {
    let busy = false
    const sent: string[] = []
    let finishTwo = (_sent: boolean) => {}
    const { handleComposerSend, settleActiveAndPump } = useAgentPromptQueue({
      isBusy: () => busy,
      submitDraft: (text: string) => {
        busy = true
        sent.push(text)
      },
      sendItem: (item: PromptQueueItem) => {
        sent.push(item.text)
        if (item.text !== 'two') return
        return new Promise<boolean>((resolve) => (finishTwo = resolve))
      },
      deferCapture: vi.fn()
    })
    const composer = useAgentComposerStore()
    composer.setText('one')
    handleComposerSend('one', [])
    composer.setText('two')
    handleComposerSend('two', [])
    composer.setText('three')
    handleComposerSend('three', [])

    busy = false
    const pumping = settleActiveAndPump()
    expect(sent).toEqual(['one', 'two'])
    await settleActiveAndPump()
    finishTwo(false)
    await pumping

    expect(sent).toEqual(['one', 'two', 'three'])
  })

  it('keeps a queued prompt in its originating chat across an A->B->A tab round trip during pending admission', async () => {
    let busy = true
    let resolveAdmission = (_result: boolean | 'deferred') => {}
    const sendItem = vi.fn(
      () =>
        new Promise<boolean | 'deferred'>((resolve) => {
          resolveAdmission = resolve
        })
    )
    const { handleComposerSend, settleActiveAndPump } = useAgentPromptQueue({
      isBusy: () => busy,
      submitDraft: vi.fn(),
      sendItem,
      deferCapture: vi.fn()
    })
    const composer = useAgentComposerStore()
    const queue = useAgentPromptQueueStore()

    queue.activateQueue('thread:a')
    composer.setText('queued on A')
    handleComposerSend('queued on A', [])
    expect(queue.items.map((item) => item.text)).toEqual(['queued on A'])

    busy = false
    const pumping = settleActiveAndPump()
    expect(sendItem).toHaveBeenCalledOnce()

    queue.activateQueue('thread:b')
    await settleActiveAndPump()
    queue.activateQueue('thread:a')
    await settleActiveAndPump()

    expect(queue.items.map((item) => item.text)).toEqual(['queued on A'])

    resolveAdmission('deferred')
    await pumping

    expect(sendItem).toHaveBeenCalledOnce()
    expect(queue.runningId).toBeNull()
    expect(queue.items.map((item) => item.text)).toEqual(['queued on A'])
  })
})
