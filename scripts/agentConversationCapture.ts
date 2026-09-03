#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import {
  zAgentConversation,
  zAgentConversationRequest,
  zAgentConversationWorkflow,
  zRecordedWsEvent
} from '../browser_tests/fixtures/data/agent/agentConversation'

const zOperation = z
  .record(z.string(), z.unknown())
  .refine(
    (operation) =>
      typeof operation.op === 'string' &&
      (FROZEN_OPS as readonly string[]).includes(operation.op),
    'unknown graph operation'
  )

const zToolCall = z.object({
  tool_call_id: z.string().min(1),
  result: z.record(z.string(), z.unknown()),
  applied_op_ids: z.array(z.string().min(1))
})

const zBackendCapture = z.object({
  schema_version: z.literal('agent-backend-capture.v1'),
  source: z.object({
    repo: z.string(),
    suite: z.string(),
    case_id: z.string(),
    note: z.string().optional()
  }),
  capture: z.object({
    backend: z.literal('Comfy-Org/cloud'),
    thread_id: z.string().min(1),
    message_id: z.string().min(1),
    exported_at: z.string().datetime()
  }),
  workflow: zAgentConversationWorkflow,
  request: zAgentConversationRequest,
  frames: z.array(zRecordedWsEvent).min(1),
  tool_calls: z.array(zToolCall)
})
export type AgentBackendCapture = z.input<typeof zBackendCapture>

function operationsFromResult(toolCall: z.infer<typeof zToolCall>) {
  const data = toolCall.result.data
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return []

  const result = data as Record<string, unknown>
  const candidates = Array.isArray(result.ops)
    ? result.ops
    : result.op === undefined
      ? []
      : [result.op]
  const operations = candidates.map((operation) => zOperation.parse(operation))
  const byId = new Map(
    operations.flatMap((operation) =>
      typeof operation.op_id === 'string'
        ? [[operation.op_id, operation] as const]
        : []
    )
  )

  return toolCall.applied_op_ids.map((opId) => {
    const operation = byId.get(opId)
    if (operation === undefined) {
      throw new Error(
        `tool call ${toolCall.tool_call_id} accepted op ${opId}, but its recorded result does not contain that op`
      )
    }
    return operation
  })
}

/**
 * Projects a cloud backend capture into the replay format. Websocket frames
 * retain their recorded order; accepted semantic ops are inserted immediately
 * before the matching terminal tool-call frame, where the live doc update was
 * observed. No operation can be authored by this exporter: every emitted op
 * must exist in the parent audit result and in its durable accepted-op rows.
 */
export function exportAgentConversation(input: unknown) {
  const capture = zBackendCapture.parse(input)
  const toolCalls = new Map(
    capture.tool_calls.map((toolCall) => [toolCall.tool_call_id, toolCall])
  )
  const emittedToolCalls = new Set<string>()
  const response: Array<
    | { kind: 'event'; event: z.infer<typeof zRecordedWsEvent>; at_ms?: number }
    | { kind: 'graph_ops'; ops: Array<Record<string, unknown>>; at_ms?: number }
  > = []
  const firstAt = capture.frames[0].at_ms
  const relativeAt = (frame: { at_ms?: number }) =>
    firstAt === undefined || frame.at_ms === undefined
      ? undefined
      : frame.at_ms - firstAt

  for (const frame of capture.frames) {
    if (
      frame.data.thread_id !== capture.capture.thread_id ||
      frame.data.message_id !== capture.capture.message_id
    ) {
      throw new Error(
        `recorded ${frame.type} frame does not belong to capture ${capture.capture.thread_id}/${capture.capture.message_id}`
      )
    }
    const at_ms = relativeAt(frame)
    const event = {
      type: frame.type,
      data: { ...frame.data }
    }
    delete event.data.thread_id
    delete event.data.message_id

    if (event.type === 'agent_tool_call') {
      const toolCallId = event.data.tool_call_id
      const status = event.data.status
      if (
        typeof toolCallId === 'string' &&
        status !== 'running' &&
        toolCalls.has(toolCallId)
      ) {
        const operations = operationsFromResult(toolCalls.get(toolCallId)!)
        if (operations.length > 0) {
          response.push({ kind: 'graph_ops', ops: operations, at_ms })
        }
        emittedToolCalls.add(toolCallId)
      }
    }
    response.push({ kind: 'event', event, at_ms })
  }

  const omitted = capture.tool_calls.filter(
    (toolCall) =>
      toolCall.applied_op_ids.length > 0 &&
      !emittedToolCalls.has(toolCall.tool_call_id)
  )
  if (omitted.length > 0) {
    throw new Error(
      `recorded response has no terminal websocket frame for tool call(s): ${omitted.map((call) => call.tool_call_id).join(', ')}`
    )
  }

  return zAgentConversation.parse({
    schema_version: 'agent-conversation.v1',
    source: {
      ...capture.source,
      response_side: 'recorded',
      capture: capture.capture
    },
    workflow: capture.workflow,
    request: capture.request,
    response
  })
}

function main(args: string[]): void {
  if (args.length !== 2) {
    throw new Error(
      'usage: pnpm exec tsx scripts/agentConversationCapture.ts <capture.json> <conversation.json>'
    )
  }
  const [inputPath, outputPath] = args
  const conversation = exportAgentConversation(
    JSON.parse(readFileSync(inputPath, 'utf8'))
  )
  writeFileSync(outputPath, `${JSON.stringify(conversation, null, 2)}\n`)
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2))
}
