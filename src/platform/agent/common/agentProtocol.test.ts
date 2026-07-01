import { describe, expect, it } from 'vitest'

import type { AgentTurnRequest } from './agentProtocol'
import {
  parseAgentEvent,
  parseDraftSnapshot,
  serializeAgentTurnRequest
} from './agentProtocol'

const data = { thread_id: 't1', message_id: 'm1' }

describe('parseAgentEvent', () => {
  it('decodes a draft_patch from the snake_case envelope', () => {
    const event = parseAgentEvent({
      type: 'draft_patch',
      data: {
        ...data,
        workflow_id: 'wf1',
        content: { nodes: [] },
        version: 8,
        base_version: 7
      }
    })
    expect(event).toEqual({
      type: 'draft_patch',
      threadId: 't1',
      messageId: 'm1',
      workflowId: 'wf1',
      content: { nodes: [] },
      version: 8,
      baseVersion: 7
    })
  })

  it('decodes a message delta', () => {
    const event = parseAgentEvent({
      type: 'agent_message_delta',
      data: { ...data, delta: 'hi' }
    })
    expect(event).toEqual({
      type: 'agent_message_delta',
      threadId: 't1',
      messageId: 'm1',
      delta: 'hi'
    })
  })

  it('decodes a tool call and drops absent optional fields', () => {
    const event = parseAgentEvent({
      type: 'agent_tool_call',
      data: {
        ...data,
        tool_call_id: 'tc1',
        tool_name: 'workflow set-slot',
        status: 'success'
      }
    })
    expect(event).toEqual({
      type: 'agent_tool_call',
      threadId: 't1',
      messageId: 'm1',
      toolCallId: 'tc1',
      toolName: 'workflow set-slot',
      status: 'success'
    })
  })

  it('maps tool call duration and error code from snake_case', () => {
    const event = parseAgentEvent({
      type: 'agent_tool_call',
      data: {
        ...data,
        tool_call_id: 'tc1',
        tool_name: 'run',
        status: 'error',
        duration_ms: 1200,
        error_code: 'OOM'
      }
    })
    expect(event).toMatchObject({ durationMs: 1200, errorCode: 'OOM' })
  })

  it('maps message done usage to tokenUsage', () => {
    const event = parseAgentEvent({
      type: 'agent_message_done',
      data: { ...data, usage: { input: 12, output: 34 } }
    })
    expect(event).toEqual({
      type: 'agent_message_done',
      threadId: 't1',
      messageId: 'm1',
      tokenUsage: { input: 12, output: 34 }
    })
  })

  it('omits tokenUsage when usage is absent', () => {
    const event = parseAgentEvent({
      type: 'agent_message_done',
      data: { ...data }
    })
    expect(event).toEqual({
      type: 'agent_message_done',
      threadId: 't1',
      messageId: 'm1'
    })
  })

  it('rejects an unknown event type', () => {
    expect(parseAgentEvent({ type: 'nope', data })).toBeNull()
  })

  it('rejects a payload with no envelope body', () => {
    expect(
      parseAgentEvent({ type: 'agent_message_delta', delta: 'hi' })
    ).toBeNull()
  })

  it('rejects a payload missing the base identifiers', () => {
    expect(
      parseAgentEvent({
        type: 'agent_message_delta',
        data: { delta: 'hi' }
      })
    ).toBeNull()
  })

  it('rejects a draft_patch with a malformed version', () => {
    const event = parseAgentEvent({
      type: 'draft_patch',
      data: {
        ...data,
        workflow_id: 'wf1',
        content: {},
        version: '8',
        base_version: 7
      }
    })
    expect(event).toBeNull()
  })

  it('rejects a draft_patch missing base_version', () => {
    const event = parseAgentEvent({
      type: 'draft_patch',
      data: { ...data, workflow_id: 'wf1', content: {}, version: 8 }
    })
    expect(event).toBeNull()
  })

  it('rejects a draft_patch with an out-of-range version', () => {
    for (const version of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
      const event = parseAgentEvent({
        type: 'draft_patch',
        data: {
          ...data,
          workflow_id: 'wf1',
          content: {},
          version,
          base_version: 7
        }
      })
      expect(event).toBeNull()
    }
  })

  it('rejects a draft_patch with an out-of-range base_version', () => {
    for (const base_version of [-1, 2.5, Number.NaN]) {
      const event = parseAgentEvent({
        type: 'draft_patch',
        data: {
          ...data,
          workflow_id: 'wf1',
          content: {},
          version: 8,
          base_version
        }
      })
      expect(event).toBeNull()
    }
  })

  it('rejects a draft_patch whose content is an array', () => {
    const event = parseAgentEvent({
      type: 'draft_patch',
      data: {
        ...data,
        workflow_id: 'wf1',
        content: [],
        version: 8,
        base_version: 7
      }
    })
    expect(event).toBeNull()
  })

  it('rejects a tool call with an invalid status', () => {
    const event = parseAgentEvent({
      type: 'agent_tool_call',
      data: {
        ...data,
        tool_call_id: 'tc1',
        tool_name: 'run',
        status: 'pending'
      }
    })
    expect(event).toBeNull()
  })
})

describe('serializeAgentTurnRequest', () => {
  it('serializes baseVersion to the snake_case body', () => {
    const request: AgentTurnRequest = {
      content: 'add a sampler',
      selection: ['1', '2'],
      attachments: ['asset-1'],
      target: 'active',
      baseVersion: 7
    }
    expect(serializeAgentTurnRequest(request)).toEqual({
      content: 'add a sampler',
      selection: ['1', '2'],
      attachments: ['asset-1'],
      target: 'active',
      base_version: 7
    })
  })

  it('omits absent optional fields', () => {
    expect(serializeAgentTurnRequest({ content: 'hi' })).toEqual({
      content: 'hi'
    })
  })

  it('keeps base_version 0 rather than dropping it', () => {
    expect(
      serializeAgentTurnRequest({ content: 'hi', baseVersion: 0 })
    ).toEqual({ content: 'hi', base_version: 0 })
  })
})

describe('parseDraftSnapshot', () => {
  it('decodes a well-formed snapshot body', () => {
    const snapshot = parseDraftSnapshot({
      content: { nodes: ['ksampler'] },
      version: 12
    })
    expect(snapshot).toEqual({ content: { nodes: ['ksampler'] }, version: 12 })
  })

  it('accepts version 0', () => {
    expect(parseDraftSnapshot({ content: {}, version: 0 })).toEqual({
      content: {},
      version: 0
    })
  })

  it('rejects a malformed or partial body', () => {
    expect(parseDraftSnapshot(null)).toBeNull()
    expect(parseDraftSnapshot({ content: { nodes: [] } })).toBeNull()
    expect(parseDraftSnapshot({ version: 3 })).toBeNull()
    expect(parseDraftSnapshot({ content: 'nope', version: 3 })).toBeNull()
    expect(parseDraftSnapshot({ content: [], version: 3 })).toBeNull()
    expect(parseDraftSnapshot({ content: {}, version: '3' })).toBeNull()
    expect(parseDraftSnapshot({ content: {}, version: Number.NaN })).toBeNull()
    expect(
      parseDraftSnapshot({ content: {}, version: Number.POSITIVE_INFINITY })
    ).toBeNull()
    expect(parseDraftSnapshot({ content: {}, version: -1 })).toBeNull()
    expect(parseDraftSnapshot({ content: {}, version: 1.5 })).toBeNull()
  })
})
