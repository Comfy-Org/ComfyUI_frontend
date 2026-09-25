import { describe, expect, it } from 'vitest'

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

  /**
   * PM-1643 / PM-717 item 3. What a rehydrated turn can say about its files
   * beyond their stored names, held to what the service's own reader of these
   * rows already does — `contentAttachments` in cloud's
   * services/agent/internal/persist/threads.go.
   */
  describe('persisted attachment resolution', () => {
    /**
     * `attachmentRefsForRow` (services/agent/server/agent_handler.go) resolves
     * each name to a library asset id and to the coarse kind behind its MIME
     * type, and `contentAttachments` reads both back. Carrying them through
     * here is what lets a file be classified when its own name cannot classify
     * it; what the renderer does with either is the sibling case in
     * UserMessage.test.ts.
     */
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

    /**
     * Reachable through the API rather than through this client: the writer
     * stores `attachments` verbatim and has never filtered it, so a blank name
     * posted by any client persists. `contentAttachments` then drops it — a
     * blank names no file — where this keeps it as an attachment, giving the
     * turn a tile with an empty caption and no resolvable preview. The row is
     * shown without a sibling `attachment_refs`, the pre-`attachment_refs`
     * legacy shape; a current writer would emit one naming `real.png`, which
     * this parser ignores anyway whenever `attachments` is an array.
     */
    it.fails('drops a blank name persisted under attachments', () => {
      const message = row(1, 'user', 'turn-a', '', 'row-1')
      message.content = { attachments: ['', 'real.png'] }

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
          id: 'call-1',
          tool_name: 'search_nodes',
          status: 'ok',
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

  it('prefers tool_call_id over id when deriving callId, matching what live frames key on', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'audit-row-uuid-1',
          tool_call_id: 'provider-call-1',
          tool_name: 'search_nodes',
          status: 'ok'
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
        { id: 'audit-row-uuid-1', tool_name: 'search_nodes', status: 'ok' }
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
        { id: 'call-1', tool_name: 'search_nodes', status: 'ok' },
        { id: 'call-2', tool_name: 'add_node', status: 'error' }
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
        { id: 'call-1', tool_name: 'search_nodes', status: 'running' }
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
        { id: 'call-1', tool_name: 'search_nodes', status: 'running' }
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

  it.for(['success', 'failed', 'cancelled', 'timeout', 'unrecognized'])(
    'maps terminal tool-call status %s through the broadened vocabulary',
    (status) => {
      const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
      message.content = {
        text: 'Done',
        tool_calls: [{ id: 'call-1', tool_name: 'search_nodes', status }]
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

  it.for([NaN, Infinity, -Infinity, -1])(
    'rejects a non-finite or negative durationMs (%s)',
    (durationMs) => {
      const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
      message.content = {
        text: 'Done',
        tool_calls: [
          {
            id: 'call-1',
            tool_name: 'search_nodes',
            status: 'ok',
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

  it('dedupes a repeated callId within one row, keeping the last entry at the first position', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [
        { id: 'call-1', tool_name: 'search_nodes', status: 'running' },
        { id: 'call-2', tool_name: 'add_node', status: 'ok' },
        {
          id: 'call-1',
          tool_name: 'search_nodes',
          status: 'ok',
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
    { tool_calls: [{ tool_name: 'no_id', status: 'ok' }] },
    { tool_calls: [{ id: 'call-1', status: 'ok' }] },
    { tool_calls: [] }
  ])('ignores malformed tool_calls metadata: $tool_calls', (content) => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = { text: 'Done', ...content }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'Done', state: 'done' }
    ])
  })

  it('dedupes a repeated callId across two assistant rows of the same turn', () => {
    const first = row(1, 'assistant', 'turn-a', '', 'row-1')
    first.content = {
      tool_calls: [{ id: 'call-1', tool_name: 'search_nodes', status: 'ok' }]
    }
    const second = row(2, 'assistant', 'turn-a', 'Done', 'row-2')
    second.content = {
      text: 'Done',
      tool_calls: [
        {
          id: 'call-1',
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

  it('renders a persisted tool call with no status field as a failure, not a dropped entry', () => {
    const message = row(1, 'assistant', 'turn-a', 'Done', 'row-1')
    message.content = {
      text: 'Done',
      tool_calls: [{ id: 'call-1', tool_name: 'search_nodes' }]
    }

    const transcript = normalizeAgentTranscript([message])

    expect(transcript.messages[0].parts).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'search_nodes',
        state: 'done',
        ok: false
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
