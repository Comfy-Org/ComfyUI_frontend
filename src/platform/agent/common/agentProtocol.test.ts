import { describe, expect, it } from 'vitest'

import { parseAgentEvent } from './agentProtocol'

const base = { threadId: 't1', messageId: 'm1' }

describe('parseAgentEvent', () => {
  it('decodes a draft_patch', () => {
    const event = parseAgentEvent({
      ...base,
      type: 'draft_patch',
      workflowId: 'wf1',
      content: { nodes: [] },
      version: 8,
      baseVersion: 7
    })
    expect(event).toMatchObject({ type: 'draft_patch', workflowId: 'wf1', version: 8 })
  })

  it('decodes a tool call and drops absent optional fields', () => {
    const event = parseAgentEvent({
      ...base,
      type: 'agent_tool_call',
      toolCallId: 'tc1',
      toolName: 'workflow set-slot',
      status: 'success'
    })
    expect(event).toEqual({
      ...base,
      type: 'agent_tool_call',
      toolCallId: 'tc1',
      toolName: 'workflow set-slot',
      status: 'success'
    })
  })

  it('rejects an unknown event type', () => {
    expect(parseAgentEvent({ ...base, type: 'nope' })).toBeNull()
  })

  it('rejects a payload missing the base identifiers', () => {
    expect(parseAgentEvent({ type: 'agent_message_delta', delta: 'hi' })).toBeNull()
  })

  it('rejects a draft_patch with a malformed version', () => {
    const event = parseAgentEvent({
      ...base,
      type: 'draft_patch',
      workflowId: 'wf1',
      content: {},
      version: '8',
      baseVersion: 7
    })
    expect(event).toBeNull()
  })

  it('rejects a tool call with an invalid status', () => {
    const event = parseAgentEvent({
      ...base,
      type: 'agent_tool_call',
      toolCallId: 'tc1',
      toolName: 'run',
      status: 'pending'
    })
    expect(event).toBeNull()
  })
})
