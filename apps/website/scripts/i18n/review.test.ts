import { describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import type { ReviewBatch, ReviewItem } from './review'
import { createOpenAiReviewer, reviewItems } from './review'

const locale: OutputLocale = { code: 'ja', name: 'Japanese' }
const config = { maxItemsPerRequest: 40, maxSourceCharsPerRequest: 6000 }

const item: ReviewItem = {
  id: '1',
  context: 'ui.copy',
  source: 'Copy',
  translation: 'コピー'
}

describe('reviewItems', () => {
  it('passes through a positive verdict', async () => {
    const reviewBatch: ReviewBatch = vi.fn(
      async () => new Map([['1', { pass: true }]])
    )

    const results = await reviewItems(locale, [item], reviewBatch, config)

    expect(results.get('1')).toEqual({ pass: true })
  })

  it('rejects an item the reviewer never returned a verdict for', async () => {
    const reviewBatch: ReviewBatch = vi.fn(async () => new Map())

    const results = await reviewItems(locale, [item], reviewBatch, config)

    expect(results.get('1')).toEqual({
      pass: false,
      reason: 'reviewer returned no verdict'
    })
  })

  it('rejects every item in a chunk whose review call throws', async () => {
    const reviewBatch: ReviewBatch = vi.fn(async () => {
      throw new Error('rate limited')
    })

    const results = await reviewItems(locale, [item], reviewBatch, config)

    expect(results.get('1')).toEqual({ pass: false, reason: 'rate limited' })
  })
})

function completion(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'cmpl',
      object: 'chat.completion',
      created: 0,
      model: 'gpt-5.6-terra',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop'
        }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

describe('createOpenAiReviewer', () => {
  it('parses a JSON verdict response', async () => {
    const fetchFn: typeof fetch = async () =>
      completion('{"1": {"pass": true}}')
    const review = createOpenAiReviewer({
      apiKey: 'test-key',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
      fetchFn
    })

    await expect(review(locale, [item])).resolves.toEqual(
      new Map([['1', { pass: true }]])
    )
  })

  it('parses a rejection with its reason', async () => {
    const fetchFn: typeof fetch = async () =>
      completion('{"1": {"pass": false, "reason": "leftover English"}}')
    const review = createOpenAiReviewer({
      apiKey: 'test-key',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
      fetchFn
    })

    await expect(review(locale, [item])).resolves.toEqual(
      new Map([['1', { pass: false, reason: 'leftover English' }]])
    )
  })

  it('returns immediately without a request for an empty batch', async () => {
    let calls = 0
    const fetchFn: typeof fetch = async () => {
      calls++
      return completion('{}')
    }
    const review = createOpenAiReviewer({
      apiKey: 'test-key',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
      fetchFn
    })

    await expect(review(locale, [])).resolves.toEqual(new Map())
    expect(calls).toBe(0)
  })

  it('throws when the response has no message content', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          id: 'cmpl',
          object: 'chat.completion',
          created: 0,
          model: 'gpt-5.6-terra',
          choices: [
            { index: 0, message: { role: 'assistant' }, finish_reason: 'stop' }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    const review = createOpenAiReviewer({
      apiKey: 'test-key',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
      fetchFn
    })

    await expect(review(locale, [item])).rejects.toThrow(/no message content/)
  })

  it('throws when the response content is not valid JSON', async () => {
    const fetchFn: typeof fetch = async () => completion('not json')
    const review = createOpenAiReviewer({
      apiKey: 'test-key',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
      fetchFn
    })

    await expect(review(locale, [item])).rejects.toThrow()
  })
})
