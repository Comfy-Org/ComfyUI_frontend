import { describe, expect, it } from 'vitest'

import { reduceThinking } from './thinkingLog'
import type { ThinkingLog } from './thinkingLog'

const streaming: ThinkingLog = {
  requestId: 'request-1',
  text: 'Checking which node sets the width.',
  done: false
}

describe('reduceThinking', () => {
  it('T-01: a new request starts with no thinking and grows as pieces arrive', () => {
    const started = reduceThinking(streaming, {
      type: 'started',
      requestId: 'request-2'
    })
    const grown = reduceThinking(started, {
      type: 'chunk',
      requestId: 'request-2',
      text: 'The width is on '
    })

    expect(started).toEqual({ requestId: 'request-2', text: '', done: false })
    expect(
      reduceThinking(grown, {
        type: 'chunk',
        requestId: 'request-2',
        text: 'Empty Latent Image.'
      })
    ).toEqual({
      requestId: 'request-2',
      text: 'The width is on Empty Latent Image.',
      done: false
    })
  })

  it('T-03: finishing keeps the text for later', () => {
    expect(
      reduceThinking(streaming, { type: 'finished', requestId: 'request-1' })
    ).toEqual({ ...streaming, done: true })
  })

  it('T-03: Clear, or a Send that shows no thinking, removes it', () => {
    expect(reduceThinking(streaming, { type: 'cleared' })).toBeNull()
  })

  it.for([
    { name: 'another request', log: streaming, requestId: 'request-9' },
    {
      name: 'a request that already finished',
      log: { ...streaming, done: true },
      requestId: 'request-1'
    },
    { name: 'no request at all', log: null, requestId: 'request-1' }
  ])('drops thinking that arrives for $name', ({ log, requestId }) => {
    expect(
      reduceThinking(log, { type: 'chunk', requestId, text: 'late' })
    ).toBe(log)
  })
})
