import { describe, expect, it } from 'vitest'

import type { AgentRequest } from './agentReply'
import { textToImageNodes } from './fakePointHost'
import recordedStream from './fixtures/openrouterThinkingStream.recorded.txt?raw'
import {
  applyPayload,
  emptyProgress,
  finishStream,
  readErrorBody,
  takePayloads
} from './modelReply'
import type { StreamProgress } from './modelReply'
import { checkReply } from './replyValidation'

const nodes = textToImageNodes()
const request: AgentRequest = {
  kind: 'batch',
  requestId: 'request-1',
  annotations: [
    {
      id: 'comment-1',
      label: 'Save Image',
      comment: 'make this wider',
      targets: [{ kind: 'node', nodeId: nodes[2].id }]
    },
    {
      id: 'comment-2',
      label: 'KSampler › steps',
      comment: 'what is this?',
      targets: [{ kind: 'setting', nodeId: nodes[0].id, setting: 'steps' }]
    }
  ],
  history: []
}

function readInPieces(stream: string, pieceSize: number): StreamProgress {
  let progress = emptyProgress
  let unfinished = ''
  for (let start = 0; start < stream.length; start += pieceSize) {
    const taken = takePayloads(
      unfinished + stream.slice(start, start + pieceSize)
    )
    unfinished = taken.rest
    progress = taken.payloads.reduce(applyPayload, progress)
  }
  return progress
}

function finished(overrides: Partial<StreamProgress>): StreamProgress {
  return { ...emptyProgress, ...overrides }
}

describe('reading a streamed answer', () => {
  it.for([64, 1000, 100_000])(
    'T-01, L-01: assembles the thinking and a reply that passes the check from a recorded stream cut every %i characters',
    (pieceSize) => {
      const progress = readInPieces(recordedStream, pieceSize)
      const outcome = finishStream(progress)

      expect(progress.thinking).toBe(
        "I'm checking which node sets the picture's width, and it's the"
      )
      expect(progress.finishReason).toBe('stop')
      expect(outcome.kind).toBe('reply')
      expect(
        outcome.kind === 'reply' && checkReply(outcome.reply, request, nodes)
      ).toMatchObject([
        {
          annotationId: 'comment-1',
          target: { kind: 'setting', nodeId: nodes[1].id, setting: 'width' },
          offerEdit: { value: 1280 },
          problems: []
        },
        { annotationId: 'comment-2', problems: [] },
        { annotationId: null, target: { kind: 'control', control: 'run' } }
      ])
    }
  )

  it('reads thinking from the details when the plain field is missing', () => {
    const payload = JSON.stringify({
      choices: [
        {
          delta: {
            reasoning_details: [
              { type: 'reasoning.text', text: 'First ' },
              { type: 'reasoning.summary', summary: 'second.' }
            ]
          }
        }
      ]
    })

    expect(applyPayload(emptyProgress, payload).thinking).toBe('First second.')
  })

  it('ignores keep-alive comments, the end marker and lines that are not JSON', () => {
    const { payloads, rest } = takePayloads(
      ': OPENROUTER PROCESSING\n\ndata: [DONE]\n\ndata: {"cho'
    )

    expect(payloads.reduce(applyPayload, emptyProgress)).toBe(emptyProgress)
    expect(rest).toBe('data: {"cho')
  })

  it('accepts a reply wrapped in a code fence', () => {
    expect(
      finishStream(finished({ content: '```json\n{"steps":[]}\n```' }))
    ).toEqual({ kind: 'reply', reply: { steps: [] } })
  })

  it.for([
    { name: 'no text', progress: finished({}) },
    { name: 'text that is not JSON', progress: finished({ content: 'Sure!' }) }
  ])('L-04: a stream that ends with $name is malformed', ({ progress }) => {
    expect(finishStream(progress)).toEqual({
      kind: 'failure',
      failure: { kind: 'malformed', detail: '' }
    })
  })

  it.for([
    {
      name: 'an error in the stream',
      progress: readInPieces(
        'data: {"error":{"code":502,"message":"Provider returned error"},"choices":[{"delta":{"content":""},"finish_reason":"error"}]}\n\n',
        1000
      ),
      detail: 'Provider returned error'
    },
    {
      name: 'a reply cut off at the token limit',
      progress: finished({ content: '{"steps":[', finishReason: 'length' }),
      detail: 'the reply was cut off at the token limit'
    },
    {
      name: 'a refusal',
      progress: finished({ finishReason: 'content_filter' }),
      detail: 'the model refused to answer'
    }
  ])('L-05: $name is a provider failure', ({ progress, detail }) => {
    expect(finishStream(progress)).toEqual({
      kind: 'failure',
      failure: { kind: 'provider', detail }
    })
  })
})

describe('readErrorBody', () => {
  it('L-05: names the status and the provider’s message', () => {
    expect(
      readErrorBody(401, { error: { code: 401, message: 'User not found.' } })
    ).toEqual({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 401: User not found.' }
    })
  })

  it('L-05: names the status alone when the body says nothing', () => {
    expect(readErrorBody(500, null)).toEqual({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 500' }
    })
  })

  it('L-10: passes on the proxy’s message when it has no key', () => {
    expect(
      readErrorBody(503, {
        error: { code: 'no_key', message: 'OPENROUTER_API_KEY is empty.' }
      })
    ).toEqual({
      kind: 'failure',
      failure: { kind: 'noKey', detail: 'OPENROUTER_API_KEY is empty.' }
    })
  })
})
