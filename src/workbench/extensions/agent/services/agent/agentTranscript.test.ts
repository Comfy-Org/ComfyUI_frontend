import { describe, expect, it, vi } from 'vitest'

import type { AgentMessages } from '../../schemas/agentApiSchema'
import { toTurnId } from '../../schemas/agentApiSchema'
import { normalizeAgentTranscript } from './agentTranscript'

const row = (
  seq: number,
  role: AgentMessages[number]['role'],
  turnId: string,
  text: string,
  id: string
): AgentMessages[number] => ({
  id,
  thread_id: 'thread-1',
  seq,
  role,
  status: 'complete',
  turn_id: turnId,
  content: { text }
})

describe('normalizeAgentTranscript', () => {
  it('restores inline reference positions from the persisted message text', () => {
    const message = row(1, 'user', 'turn-a', '', 'row-1')
    message.content = {
      text: 'Copy [A](workflow://wf-a) into [B](workflow://wf-b).',
      workflow_references: [
        { workflow_id: 'wf-a', name: 'A' },
        { workflow_id: 'wf-b', name: 'B', unavailable: true }
      ]
    }
    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userTexts.get(toTurnId('turn-a'))).toBe('Copy  into .')
    expect(transcript.userWorkflowReferences.get(toTurnId('turn-a'))).toEqual([
      { id: 'wf-a', name: 'A', textOffset: 5 },
      { id: 'wf-b', name: 'B', unavailable: true, textOffset: 11 }
    ])
  })

  it('ignores empty workflow ids when restoring the latest target', () => {
    const target = {
      ...row(1, 'user', 'turn-a', 'Edit A', 'row-1'),
      workflow_id: 'wf-a'
    }
    const detached = {
      ...row(2, 'user', 'turn-b', 'Hello', 'row-2'),
      workflow_id: ''
    }
    expect(
      normalizeAgentTranscript([detached]).latestWorkflowId
    ).toBeUndefined()
    expect(normalizeAgentTranscript([target, detached]).latestWorkflowId).toBe(
      'wf-a'
    )
  })
  // The turn is waiting on the ask whether or not the panel can show it, so a
  // restored stand-in notice keeps it live and Stop stays available.
  it('keeps a restored turn live when its pending ask cannot be shown', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const waiting = {
      ...row(2, 'assistant', 'turn-a', '', 'row-2'),
      status: 'streaming',
      pending_ask: {
        message_id: 'row-2',
        ask_id: 'ask-9',
        kind: 'something_new',
        prompt: 'Pick one',
        options: [{ id: 'a', label: 'A' }],
        min_selections: 1,
        max_selections: 1,
        allow_other: false
      }
    } as AgentMessages[number]

    const transcript = normalizeAgentTranscript([
      row(1, 'user', 'turn-a', 'Go', 'row-1'),
      waiting
    ])

    expect(transcript.messages[0]).toMatchObject({
      streaming: true,
      parts: [{ type: 'notice', askId: 'ask-9' }]
    })
    expect(transcript.pending?.messageId).toBe('row-2')
  })

  it('orders rows by sequence and groups them by stable turn identity', () => {
    const transcript = normalizeAgentTranscript([
      row(4, 'assistant', 'turn-b', 'Second reply', 'row-4'),
      row(2, 'assistant', 'turn-a', 'First reply', 'row-2'),
      row(1, 'user', 'turn-a', 'First prompt', 'row-1'),
      row(3, 'user', 'turn-b', 'Second prompt', 'row-3')
    ])

    expect(transcript.messages.map((message) => message.id)).toEqual([
      'turn-a',
      'turn-b'
    ])
    expect(transcript.userTexts.get(toTurnId('turn-a'))).toBe('First prompt')
    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'First reply', state: 'done' }
    ])
    expect(transcript.rowIds).toEqual(
      new Set(['row-1', 'row-2', 'row-3', 'row-4'])
    )
  })

  it('keeps message identity stable when persisted row ids change', () => {
    const first = normalizeAgentTranscript([
      row(1, 'user', 'turn-a', 'Prompt', 'user-row-v1'),
      row(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v1')
    ])
    const refreshed = normalizeAgentTranscript([
      row(1, 'user', 'turn-a', 'Prompt', 'user-row-v2'),
      row(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v2')
    ])

    expect(refreshed.messages[0].id).toBe(first.messages[0].id)
    expect(refreshed.messages[0].id).toBe('turn-a')
    expect(refreshed.assistantTurnIds).toEqual(new Set(['turn-a']))
  })

  it('keeps user-only turns while ignoring non-text transcript content', () => {
    const userOnly = row(1, 'user', 'turn-a', 'Prompt', 'row-1')
    const toolRow = row(2, 'tool', 'turn-a', '', 'row-2')
    toolRow.content = { result: { nodeCount: 2 } }

    const transcript = normalizeAgentTranscript([toolRow, userOnly])

    expect(transcript.messages).toEqual([
      {
        id: 'turn-a',
        role: 'assistant',
        parts: [],
        thinking: false,
        streaming: false
      }
    ])
    expect(transcript.userTexts.get(toTurnId('turn-a'))).toBe('Prompt')
    expect(transcript.assistantTurnIds).toEqual(new Set())
    expect(transcript.rowIds).toEqual(new Set(['row-1', 'row-2']))
  })

  it('concatenates assistant rows in sequence order within a turn', () => {
    const transcript = normalizeAgentTranscript([
      row(3, 'assistant', 'turn-a', 'Second', 'row-3'),
      row(1, 'user', 'turn-a', 'Prompt', 'row-1'),
      row(2, 'assistant', 'turn-a', 'First', 'row-2')
    ])

    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'First', state: 'done' },
      { type: 'text', text: 'Second', state: 'done' }
    ])
  })

  it('restores a user attachment preview from persisted content.attachments', () => {
    const message = row(1, 'user', 'turn-a', 'check this image', 'row-1')
    message.content = {
      text: 'check this image',
      attachments: ['ComfyUI_00002_.png'],
      attachment_refs: [
        { name: 'ComfyUI_00002_.png', id: 'asset-1', kind: 'image' }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
      { name: 'ComfyUI_00002_.png', ref: 'ComfyUI_00002_.png' }
    ])
  })

  it('falls back to attachment_refs names when content.attachments is absent', () => {
    const message = row(1, 'user', 'turn-a', 'check this image', 'row-1')
    message.content = {
      text: 'check this image',
      attachment_refs: [{ name: 'ComfyUI_00002_.png', kind: 'image' }]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
      { name: 'ComfyUI_00002_.png', ref: 'ComfyUI_00002_.png' }
    ])
  })

  it('leaves userAttachments empty for a turn with no attachment fields', () => {
    const message = row(1, 'user', 'turn-a', 'no attachments here', 'row-1')

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userAttachments.has(toTurnId('turn-a'))).toBe(false)
  })

  it.for([
    {
      content: { attachments: [null, 17, 'first.png', 'second.mp4'] },
      expected: [
        { name: 'first.png', ref: 'first.png' },
        { name: 'second.mp4', ref: 'second.mp4' }
      ]
    },
    {
      content: {
        attachments: null,
        attachment_refs: [
          null,
          false,
          {},
          { name: 17 },
          { name: 'fallback.jpg' }
        ]
      },
      expected: [{ name: 'fallback.jpg', ref: 'fallback.jpg' }]
    },
    {
      content: { attachment_refs: { name: 'not-an-array.png' } },
      expected: undefined
    }
  ])(
    'ignores malformed attachment metadata: $content',
    ({ content, expected }) => {
      const message = row(1, 'user', 'turn-a', '', 'row-1')
      message.content = content

      const transcript = normalizeAgentTranscript([message])

      expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual(
        expected
      )
    }
  )

  it('restores available and unavailable references without changing the latest workflow target', () => {
    const first = row(1, 'user', 'turn-a', 'Compare these', 'row-1')
    first.workflow_id = 'wf-target-a'
    first.content = {
      text: 'Compare these',
      workflow_references: [
        { workflow_id: 'wf-reference', name: 'Reference' },
        {
          workflow_id: 'wf-unavailable',
          name: 'My upscaler',
          unavailable: true
        }
      ]
    }
    const latest = row(3, 'user', 'turn-b', 'Now edit B', 'row-3')
    latest.workflow_id = 'wf-target-b'

    const transcript = normalizeAgentTranscript([
      latest,
      row(2, 'assistant', 'turn-a', 'Done', 'row-2'),
      first
    ])

    expect(transcript).toMatchObject({ latestWorkflowId: 'wf-target-b' })
    expect(transcript).toMatchObject({
      userWorkflowReferences: new Map([
        [
          'turn-a',
          [
            { id: 'wf-reference', name: 'Reference' },
            { id: 'wf-unavailable', name: 'My upscaler', unavailable: true }
          ]
        ]
      ])
    })
  })
})
