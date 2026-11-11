import type { AgentRequest } from './agentReply'
import type { PointConfig } from './config'
import { buildChatBody } from './modelPrompt'
import {
  applyPayload,
  emptyProgress,
  failed,
  finishStream,
  readErrorBody,
  takePayloads
} from './modelReply'
import type { AgentOutcome } from './modelReply'
import { MODEL_PROXY_PORT } from './modelWire'
import type { HostNode } from './pointHost'
import { answerRequest } from './scriptedAgent'

interface AskOptions {
  signal: AbortSignal
  /** Called with each new piece of the model's thinking as it arrives. */
  onThinking: (text: string) => void
  /** Called once, when the request has ended one way or another. */
  onOutcome: (outcome: AgentOutcome) => void
}

/** One way of getting an unchecked reply for a batch of comments. */
export interface AgentBackend {
  ask(
    request: AgentRequest,
    nodes: readonly HostNode[],
    options: AskOptions
  ): void
}

/** Where the layer posts a batch for the real model. */
export const CHAT_URL = `http://127.0.0.1:${MODEL_PROXY_PORT}/chat`

/**
 * The scripted agent after its configured delay. It ignores the signal, so a
 * cancelled request still gets a late reply, as an uncancellable call would.
 */
export function scriptedBackend(
  scripted: PointConfig['scripted']
): AgentBackend {
  return {
    ask(request, nodes, { onOutcome }) {
      const reply = answerRequest(request, nodes, {
        wrongTarget: scripted.wrongTarget
      })
      setTimeout(
        () => onOutcome({ kind: 'reply', reply }),
        scripted.replyDelayMs
      )
    }
  }
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  onThinking: (text: string) => void,
  onArrival: () => void
): Promise<AgentOutcome> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let progress = emptyProgress
  let unfinished = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return finishStream(progress)
    onArrival()
    const taken = takePayloads(
      unfinished + decoder.decode(value, { stream: true })
    )
    unfinished = taken.rest
    for (const payload of taken.payloads) {
      const next = applyPayload(progress, payload)
      const thought = next.thinking.slice(progress.thinking.length)
      if (thought) onThinking(thought)
      progress = next
    }
  }
}

async function askModel(
  model: PointConfig['model'],
  request: AgentRequest,
  nodes: readonly HostNode[],
  { signal, onThinking }: AskOptions
): Promise<AgentOutcome> {
  const call = new AbortController()
  const seen = { silence: false, answer: false }
  let timer: ReturnType<typeof setTimeout> | undefined
  function restartSilenceTimer(): void {
    clearTimeout(timer)
    timer = setTimeout(() => {
      seen.silence = true
      call.abort()
    }, model.silenceTimeoutMs)
  }
  function cancel(): void {
    call.abort()
  }
  signal.addEventListener('abort', cancel)
  restartSilenceTimer()
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildChatBody(request, nodes, model)),
      signal: call.signal
    })
    seen.answer = true
    if (!response.ok || !response.body)
      return readErrorBody(
        response.status,
        await response.json().catch(() => null)
      )
    return await readStream(response.body, onThinking, restartSilenceTimer)
  } catch {
    if (seen.silence)
      return failed('timeout', String(model.silenceTimeoutMs / 1000))
    if (signal.aborted) return { kind: 'cancelled' }
    return seen.answer
      ? failed('provider', 'the connection to the model was lost')
      : failed('proxyDown')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}

/** A real model through the local proxy, streamed, with no added delay. */
export function modelBackend(model: PointConfig['model']): AgentBackend {
  return {
    ask(request, nodes, options) {
      void askModel(model, request, nodes, options).then(options.onOutcome)
    }
  }
}
