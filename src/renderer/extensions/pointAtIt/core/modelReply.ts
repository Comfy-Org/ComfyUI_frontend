import { z } from 'zod'

import type { RequestFailure } from './pointState'

/** How one request to an agent ended, before its reply is checked. */
export type AgentOutcome =
  | { kind: 'reply'; reply: unknown }
  | { kind: 'failure'; failure: RequestFailure }
  | { kind: 'cancelled' }

/** What has arrived of one streamed answer. */
export interface StreamProgress {
  thinking: string
  content: string
  finishReason: string | null
  error: string | null
}

const MAX_DETAIL_CHARS = 160

const errorBody = z.object({
  error: z.object({
    code: z.union([z.string(), z.number()]).nullish(),
    message: z.string().nullish()
  })
})

const streamChunk = z.object({
  error: errorBody.shape.error.nullish(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        delta: z
          .object({
            content: z.string().nullish(),
            reasoning: z.string().nullish(),
            reasoning_details: z
              .array(
                z.object({
                  text: z.string().nullish(),
                  summary: z.string().nullish()
                })
              )
              .nullish()
          })
          .nullish()
      })
    )
    .nullish()
})

type StreamDelta = NonNullable<
  NonNullable<z.infer<typeof streamChunk>['choices']>[number]['delta']
>

export const emptyProgress: StreamProgress = {
  thinking: '',
  content: '',
  finishReason: null,
  error: null
}

export function failed(
  kind: RequestFailure['kind'],
  detail = ''
): AgentOutcome {
  return { kind: 'failure', failure: { kind, detail } }
}

/** Reads the JSON body of an answer that is not a stream: always a failure. */
export function readErrorBody(status: number, body: unknown): AgentOutcome {
  const parsed = errorBody.safeParse(body)
  const error = parsed.success ? parsed.data.error : null
  if (error?.code === 'no_key') return failed('noKey', error.message ?? '')
  const message = error?.message ? `: ${error.message}` : ''
  return failed(
    'provider',
    `status ${status}${message}`.slice(0, MAX_DETAIL_CHARS)
  )
}

/** Splits streamed text into complete `data:` payloads and the unfinished rest. */
export function takePayloads(buffer: string): {
  payloads: string[]
  rest: string
} {
  const lines = buffer.split(/\r?\n/)
  const rest = lines.pop() ?? ''
  const payloads = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
  return { payloads, rest }
}

function thinkingIn(delta: StreamDelta): string {
  if (delta.reasoning) return delta.reasoning
  return (delta.reasoning_details ?? [])
    .map((detail) => detail.text ?? detail.summary ?? '')
    .join('')
}

function parseChunk(payload: string): z.infer<typeof streamChunk> | null {
  try {
    const chunk = streamChunk.safeParse(JSON.parse(payload))
    return chunk.success ? chunk.data : null
  } catch {
    return null
  }
}

/** Adds one streamed payload to what has arrived so far. */
export function applyPayload(
  progress: StreamProgress,
  payload: string
): StreamProgress {
  const chunk = parseChunk(payload)
  if (!chunk) return progress
  const choice = chunk.choices?.at(0)
  const delta = choice?.delta
  return {
    thinking: progress.thinking + (delta ? thinkingIn(delta) : ''),
    content: progress.content + (delta?.content ?? ''),
    finishReason: choice?.finish_reason ?? progress.finishReason,
    error: chunk.error
      ? (chunk.error.message ?? String(chunk.error.code ?? 'error'))
      : progress.error
  }
}

function withoutCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '')
}

/** Turns a finished stream into a reply to check, or a failure. */
export function finishStream(progress: StreamProgress): AgentOutcome {
  if (progress.error)
    return failed('provider', progress.error.slice(0, MAX_DETAIL_CHARS))
  if (progress.finishReason === 'length')
    return failed('provider', 'the reply was cut off at the token limit')
  if (progress.finishReason === 'content_filter')
    return failed('provider', 'the model refused to answer')
  if (!progress.content.trim()) return failed('malformed')
  try {
    const reply: unknown = JSON.parse(withoutCodeFence(progress.content))
    return { kind: 'reply', reply }
  } catch {
    return failed('malformed')
  }
}
