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

const zBackendTurn = z.object({
  message_id: z.string().min(1),
  request: zAgentConversationRequest,
  frames: z.array(zRecordedWsEvent).min(1),
  // Index into frames of the last frame that arrived before the cancel.
  cancel_after_frame: z.number().int().nonnegative().optional(),
  tool_calls: z.array(zToolCall)
})

const zBackendCapture = z.object({
  schema_version: z.literal('agent-backend-capture.v2'),
  source: z.object({
    repo: z.string(),
    suite: z.string(),
    case_id: z.string(),
    note: z.string().optional()
  }),
  capture: z.object({
    backend: z.literal('Comfy-Org/cloud'),
    thread_id: z.string().min(1),
    exported_at: z.string().datetime()
  }),
  workflow: zAgentConversationWorkflow,
  turns: z.array(zBackendTurn).min(1)
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

// Ops are inserted before their terminal tool-call frame and must exist in the accepted-op rows; nothing is authored here.
function exportTurn(turn: z.infer<typeof zBackendTurn>, threadId: string) {
  const toolCalls = new Map(
    turn.tool_calls.map((toolCall) => [toolCall.tool_call_id, toolCall])
  )
  const emittedToolCalls = new Set<string>()
  const response: Array<
    | { kind: 'event'; event: z.infer<typeof zRecordedWsEvent>; at_ms?: number }
    | { kind: 'graph_ops'; ops: Array<Record<string, unknown>>; at_ms?: number }
  > = []
  let cancelAfter: number | undefined
  const firstAt = turn.frames[0].at_ms
  const relativeAt = (frame: { at_ms?: number }) =>
    firstAt === undefined || frame.at_ms === undefined
      ? undefined
      : frame.at_ms - firstAt

  for (const frame of turn.frames) {
    if (
      frame.data.thread_id !== threadId ||
      frame.data.message_id !== turn.message_id
    ) {
      throw new Error(
        `recorded ${frame.type} frame does not belong to turn ${threadId}/${turn.message_id}`
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
      if (status !== 'running' && status !== 'success' && status !== 'error') {
        throw new Error(
          `recorded agent_tool_call frame carries status ${JSON.stringify(status)}; only running, success or error are known`
        )
      }
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
    if (turn.cancel_after_frame === turn.frames.indexOf(frame))
      cancelAfter = response.length - 1
  }

  const omitted = turn.tool_calls.filter(
    (toolCall) =>
      toolCall.applied_op_ids.length > 0 &&
      !emittedToolCalls.has(toolCall.tool_call_id)
  )
  if (omitted.length > 0) {
    throw new Error(
      `recorded response has no terminal websocket frame for tool call(s): ${omitted.map((call) => call.tool_call_id).join(', ')}`
    )
  }
  return {
    message_id: turn.message_id,
    request: turn.request,
    cancel_after: cancelAfter,
    response
  }
}

export function exportAgentConversation(input: unknown) {
  const capture = zBackendCapture.parse(input)
  return zAgentConversation.parse({
    schema_version: 'agent-conversation.v2',
    source: {
      ...capture.source,
      response_side: 'recorded',
      capture: capture.capture
    },
    workflow: capture.workflow,
    turns: capture.turns.map((turn) =>
      exportTurn(turn, capture.capture.thread_id)
    )
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
