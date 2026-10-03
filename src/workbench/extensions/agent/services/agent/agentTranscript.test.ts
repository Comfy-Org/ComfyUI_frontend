import { assert, describe, expect, it } from 'vitest'

import type { AgentMessages } from '../../schemas/agentApiSchema'
import { toTurnId, zAgentMessages } from '../../schemas/agentApiSchema'
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

  it('keeps a streaming assistant row pending even without a run approval ask', () => {
    const streamingRow = {
      ...row(2, 'assistant', 'turn-a', 'Partial reply', 'assistant-row'),
      status: 'streaming' as const
    }

    const transcript = normalizeAgentTranscript([
      row(1, 'user', 'turn-a', 'Prompt', 'user-row'),
      streamingRow
    ])

    assert.exists(transcript.pending)
    expect(transcript.pending.messageId).toBe('assistant-row')
    expect(transcript.pending.message).toBe(transcript.messages[0])
    expect(transcript.messages[0]).toMatchObject({
      streaming: true,
      parts: [{ type: 'text', text: 'Partial reply', state: 'done' }]
    })
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
      {
        name: 'ComfyUI_00002_.png',
        ref: 'ComfyUI_00002_.png',
        id: 'asset-1',
        kind: 'image'
      }
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
      { name: 'ComfyUI_00002_.png', ref: 'ComfyUI_00002_.png', kind: 'image' }
    ])
  })

  it('keeps an empty attachments list authoritative over stale refs', () => {
    const message = row(1, 'user', 'turn-a', 'no attachment', 'row-1')
    message.content = {
      attachments: [],
      attachment_refs: [{ name: 'stale.png', kind: 'image' }]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userAttachments.get(toTurnId('turn-a'))).toBeUndefined()
  })

  it('uses a persisted display name without changing the storage ref', () => {
    const message = row(1, 'user', 'turn-a', '', 'row-1')
    message.content = {
      text: 'inspect this',
      attachments: ['content-hash'],
      attachment_refs: [
        {
          name: 'content-hash',
          display_name: 'Beach photo.png',
          id: 'asset-1',
          kind: 'image'
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
      {
        name: 'Beach photo.png',
        ref: 'content-hash',
        id: 'asset-1',
        kind: 'image'
      }
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

  it.for([
    {
      label: 'several files in their recorded order',
      attachments: ['poster.png', 'clip.mp4', 'score.mp3'],
      expected: [
        { name: 'poster.png', ref: 'poster.png' },
        { name: 'clip.mp4', ref: 'clip.mp4' },
        { name: 'score.mp3', ref: 'score.mp3' }
      ]
    },
    {
      label: 'the same filename twice, uncollapsed',
      attachments: ['crop.png', 'crop.png'],
      expected: [
        { name: 'crop.png', ref: 'crop.png' },
        { name: 'crop.png', ref: 'crop.png' }
      ]
    }
  ])('restores $label', ({ attachments, expected }) => {
    const message = row(1, 'user', 'turn-a', 'use these', 'row-1')
    message.content = { text: 'use these', attachments }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual(expected)
  })

  it('restores an attachment-only turn that carries no prompt text', () => {
    const message = row(1, 'user', 'turn-a', '', 'row-1')
    message.content = { attachments: ['silent.png'] }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.userTexts.get(toTurnId('turn-a'))).toBe('')
    expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
      { name: 'silent.png', ref: 'silent.png' }
    ])
  })

  it("keeps a turn's attachments off a sibling turn that has none", () => {
    const withFile = row(1, 'user', 'turn-a', 'first', 'row-1')
    withFile.content = { text: 'first', attachments: ['only-here.png'] }

    const transcript = normalizeAgentTranscript([
      withFile,
      row(2, 'assistant', 'turn-a', 'Got it', 'row-2'),
      row(3, 'user', 'turn-b', 'second', 'row-3'),
      row(4, 'assistant', 'turn-b', 'Sure', 'row-4')
    ])

    expect(transcript.userAttachments).toEqual(
      new Map([['turn-a', [{ name: 'only-here.png', ref: 'only-here.png' }]]])
    )
  })

  /** PM-1643 / PM-717: metadata preserved in persisted attachment refs. */
  describe('persisted attachment resolution', () => {
    it('keeps the resolved asset id and media kind the server persisted on a ref', () => {
      const bareDigest = 'a'.repeat(64)
      const message = row(1, 'user', 'turn-a', 'check this clip', 'row-1')
      message.content = {
        text: 'check this clip',
        attachments: [bareDigest],
        attachment_refs: [{ name: bareDigest, id: 'asset-42', kind: 'video' }]
      }

      const transcript = normalizeAgentTranscript([message])

      expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
        expect.objectContaining({ id: 'asset-42', kind: 'video' })
      ])
    })

    it('resolves a padded name against the trimmed ref the server stored', () => {
      const message = row(1, 'user', 'turn-a', 'check this clip', 'row-1')
      message.content = {
        text: 'check this clip',
        attachments: [' clip.dat '],
        attachment_refs: [{ name: 'clip.dat', id: 'asset-7', kind: 'video' }]
      }

      const transcript = normalizeAgentTranscript([message])

      expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
        { name: ' clip.dat ', ref: ' clip.dat ', id: 'asset-7', kind: 'video' }
      ])
    })

    it('drops a blank name persisted under attachments', () => {
      const message = row(1, 'user', 'turn-a', '', 'row-1')
      message.content = { attachments: ['', '   ', 'real.png'] }

      const transcript = normalizeAgentTranscript([message])

      expect(transcript.userAttachments.get(toTurnId('turn-a'))).toEqual([
        { name: 'real.png', ref: 'real.png' }
      ])
    })
  })

  it('restores persisted tool calls as ToolPart entries ahead of the reply text', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-row-uuid-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success',
          duration_ms: 420
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: true,
        durationMs: 420
      },
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('restores a persisted skill name', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      tool_calls: [
        {
          id: 'audit-row-uuid-1',
          tool_call_id: 'call-1',
          tool_name: 'load_skill',
          status: 'success',
          skill: 'comfy-director'
        }
      ]
    }

    const parsed = zAgentMessages.parse([message])

    expect(normalizeAgentTranscript(parsed).messages[0].parts[0]).toMatchObject(
      {
        skill: 'comfy-director'
      }
    )
  })

  it('retains a persisted tool call with a null skill', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      tool_calls: [
        {
          id: 'audit-row-uuid-1',
          tool_call_id: 'call-1',
          tool_name: 'load_skill',
          status: 'success',
          skill: null
        }
      ]
    }

    const parsed = zAgentMessages.parse([message])

    expect(normalizeAgentTranscript(parsed).messages[0].parts[0]).toEqual({
      type: 'tool',
      callId: 'call-1',
      name: 'load_skill',
      state: 'done',
      ok: true,
      durationMs: undefined
    })
  })

  it('keys callId on tool_call_id, matching what live frames key on', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-row-uuid-1',
          tool_call_id: 'provider-call-1',
          tool_name: 'search_nodes',
          status: 'success'
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'provider-call-1',
        name: 'search_nodes',
        state: 'done',
        ok: true
      },
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('falls back to id for callId when a row was recorded before tool_call_id existed', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        { id: 'audit-row-uuid-1', tool_name: 'search_nodes', status: 'success' }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toContainEqual(
      expect.objectContaining({ callId: 'audit-row-uuid-1' })
    )
  })

  it('omits tool parts entirely when a message carries no tool_calls', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('restores multiple tool calls per message in order', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success'
        },
        {
          id: 'audit-2',
          tool_call_id: 'call-2',
          tool_name: 'add_node',
          status: 'error'
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: true
      },
      {
        type: 'tool',
        callId: 'call-2',
        name: 'add_node',
        state: 'done',
        ok: false
      },
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('clamps a restored pending/running tool call to done+ok:false with no live transport', () => {
    const message = row(1, 'assistant', 'turn-a', '', 'row-1')
    message.content = {
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'running'
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: false
      }
    ])
  })

  it('keeps a pending/running tool call streaming when its row is the live run_approval ask', () => {
    const message = row(1, 'assistant', 'turn-a', '', 'row-1')
    message.status = 'streaming'
    message.content = {
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'running'
        }
      ]
    }
    message.pending_ask = {
      message_id: 'row-1',
      ask_id: 'ask-1',
      kind: 'run_approval',
      prompt: 'Run it?',
      options: [],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toContainEqual({
      type: 'tool',
      callId: 'call-1',
      name: 'search_nodes',
      state: 'streaming'
    })
    expect(transcript.pending?.messageId).toBe('row-1')
  })

  // PM-1776 / PM-1682: the counterpart of the clamp above. A server row that
  // is still `streaming` is the best snapshot signal available to a client
  // hydrating mid-turn, so it restores a live turn, ask or no ask.
  it('restores a row the server still reports as streaming as the live turn', () => {
    const message = row(1, 'assistant', 'turn-a', '', 'row-1')
    message.status = 'streaming'

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.pending?.messageId).toBe('row-1')
    expect(transcript.messages[0].streaming).toBe(true)
  })

  // The pair below fixes which trailing row counts as "a later turn started".
  // `StartTurn` writes a turn's user and assistant rows in one transaction, so
  // a started turn always has an assistant row; a trailing row without one
  // belongs to no turn the server ever began, and treating it as one would put
  // the thread back in PM-1776's state -- no indicator, and a send answered
  // with 409.
  it('keeps a streaming row that only a later assistant-less row follows', () => {
    const live = row(1, 'assistant', 'turn-a', '', 'row-1')
    live.status = 'streaming'

    const transcript = normalizeAgentTranscript([
      live,
      row(2, 'user', 'turn-b', 'next', 'row-2')
    ])

    expect(transcript.pending?.messageId).toBe('row-1')
    expect(transcript.messages[0].streaming).toBe(true)
  })

  it('ignores a streaming row an older turn left behind', () => {
    const stale = row(1, 'assistant', 'turn-a', '', 'row-1')
    stale.status = 'streaming'

    const transcript = normalizeAgentTranscript([
      stale,
      row(2, 'user', 'turn-b', 'next', 'row-2'),
      row(3, 'assistant', 'turn-b', 'all done', 'row-3')
    ])

    expect(transcript.pending).toBeUndefined()
    expect(transcript.messages.map((message) => message.streaming)).toEqual([
      false,
      false
    ])
  })

  // A turn's own later row retires it just as a later turn does. Rows of one
  // turn share a message, so the turn-level check above cannot see this: the
  // stale row's `pending` still points at the message the newest turn owns.
  it('ignores a streaming row a later row of the same turn completed', () => {
    const started = row(1, 'assistant', 'turn-a', '', 'row-1')
    started.status = 'streaming'

    const transcript = normalizeAgentTranscript([
      started,
      row(2, 'assistant', 'turn-a', 'all done', 'row-2')
    ])

    expect(transcript.pending).toBeUndefined()
    expect(transcript.messages[0].streaming).toBe(false)
    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'all done', state: 'done' }
    ])
  })

  // Only a transport can resolve an ask, and a demoted row is not getting one.
  // Kept, the card renders enabled and answering it posts against a turn that
  // is no longer active -- a button that silently does nothing.
  it('drops the approval card from a streaming row a later turn retired', () => {
    const asked = row(1, 'assistant', 'turn-a', '', 'row-1')
    asked.status = 'streaming'
    asked.pending_ask = {
      message_id: 'row-1',
      ask_id: 'ask-1',
      kind: 'run_approval',
      prompt: 'Run it?',
      options: [],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }

    const transcript = normalizeAgentTranscript([
      asked,
      row(2, 'user', 'turn-b', 'next', 'row-2'),
      row(3, 'assistant', 'turn-b', 'all done', 'row-3')
    ])

    expect(transcript.pending).toBeUndefined()
    expect(transcript.messages[0].parts).toEqual([])
  })

  it.for(['success', 'error'] as const)(
    'maps terminal tool-call status %s to ok matching status === success',
    (status) => {
      const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
      message.content = {
        text: 'Done',
        tool_calls: [
          {
            id: 'audit-1',
            tool_call_id: 'call-1',
            tool_name: 'search_nodes',
            status
          }
        ]
      }

      const transcript = normalizeAgentTranscript([message])

      expect(transcript.messages[0].parts).toContainEqual({
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: status === 'success'
      })
    }
  )

  it.for([Infinity, -Infinity, -1])(
    'omits durationMs for a non-finite or negative duration_ms (%s) without dropping the entry',
    (durationMs) => {
      const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
      message.content = {
        text: 'Done',
        tool_calls: [
          {
            id: 'audit-1',
            tool_call_id: 'call-1',
            tool_name: 'search_nodes',
            status: 'success',
            duration_ms: durationMs
          }
        ]
      }

      const transcript = normalizeAgentTranscript([message])

      expect(transcript.messages[0].parts).toContainEqual({
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: true
      })
    }
  )

  it('drops the whole tool-call entry when duration_ms is NaN, matching the live schema (z.number()) rejecting it', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success',
          duration_ms: NaN
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('accepts a non-integer duration_ms, matching the live path leniency', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success',
          duration_ms: 420.5
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toContainEqual({
      type: 'tool',
      callId: 'call-1',
      name: 'search_nodes',
      state: 'done',
      ok: true,
      durationMs: 420.5
    })
  })

  it('treats the older ok status alias the same as success', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'ok'
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toContainEqual({
      type: 'tool',
      callId: 'call-1',
      name: 'search_nodes',
      state: 'done',
      ok: true
    })
  })

  it('dedupes a repeated callId within one row, keeping the last entry at the first position', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success'
        },
        {
          id: 'audit-2',
          tool_call_id: 'call-2',
          tool_name: 'add_node',
          status: 'success'
        },
        {
          id: 'audit-3',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success',
          duration_ms: 420
        }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: true,
        durationMs: 420
      },
      {
        type: 'tool',
        callId: 'call-2',
        name: 'add_node',
        state: 'done',
        ok: true
      },
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it.for([
    { tool_calls: 'not-an-array' },
    { tool_calls: [null, 17, 'a-string'] },
    { tool_calls: [{ tool_name: 'no_id', status: 'success' }] },
    {
      tool_calls: [{ id: 'call-1', tool_call_id: 'call-1', status: 'success' }]
    },
    { tool_calls: [] }
  ])('ignores malformed tool_calls metadata: $tool_calls', (content) => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      ...content
    } as unknown as AgentMessages[number]['content']

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('dedupes a repeated callId across two assistant rows of the same turn', () => {
    const first = row(1, 'assistant', 'turn-a', '', 'row-1')
    first.content = {
      tool_calls: [
        {
          id: 'audit-1',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'success'
        }
      ]
    }
    const second = row(2, 'assistant', 'turn-a', 'Done', 'row-2')
    second.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-2',
          tool_call_id: 'call-1',
          tool_name: 'search_nodes',
          status: 'error',
          duration_ms: 900
        }
      ]
    }

    const transcript = normalizeAgentTranscript([first, second])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: true
      },
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('drops a persisted tool call entry with no status field, since status is required by the generated contract', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        { id: 'audit-1', tool_call_id: 'call-1', tool_name: 'search_nodes' }
      ]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('does not fail the whole history load through zAgentMessages.parse() when one tool-call entry is malformed (regression for agent_history_load_failed)', () => {
    // A raw wire payload, not the pre-typed `row()` fixture: this goes
    // through the real `zAgentMessages.parse()` boundary that
    // `agentRestClient.ts`'s `getMessages()` calls (and which throws, not
    // safeParse). Before the fix, `content.tool_calls` was typed as
    // `z.array(zToolCallSummary)`, so the single malformed entry below
    // (missing `tool_name`) would have thrown during `.parse()` and failed
    // the ENTIRE array -- every row, not just this one entry.
    const rawHistory: unknown = [
      {
        id: 'row-1',
        thread_id: 'thread-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn-a',
        content: { text: 'Search for upscalers' }
      },
      {
        id: 'row-2',
        thread_id: 'thread-1',
        seq: 2,
        role: 'assistant',
        status: 'complete',
        turn_id: 'turn-a',
        content: {
          text: 'Done',
          tool_calls: [
            // Malformed: no tool_name, so it can never become a ToolPart --
            // this one entry should degrade, not the whole load.
            { id: 'audit-bad', tool_call_id: 'call-bad', status: 'success' },
            {
              id: 'audit-good',
              tool_call_id: 'call-good',
              tool_name: 'search_nodes',
              status: 'success'
            }
          ]
        }
      }
    ]

    let parsed: AgentMessages | undefined
    expect(() => {
      parsed = zAgentMessages.parse(rawHistory)
    }).not.toThrow()
    expect(parsed).toHaveLength(2)

    const transcript = normalizeAgentTranscript(parsed!)

    // The whole history loaded: both turns' content is present.
    expect(transcript.userTexts.get(toTurnId('turn-a'))).toBe(
      'Search for upscalers'
    )
    // Only the malformed entry degraded -- the valid sibling tool call and
    // the reply text still rendered.
    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-good',
        name: 'search_nodes',
        state: 'done',
        ok: true
      },
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

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
