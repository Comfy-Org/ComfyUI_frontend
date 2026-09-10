import { describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import type { TranslateBatch, TranslationItem } from './translate'
import { createOpenAiTranslator, translateItems } from './translate'

const locale: OutputLocale = { code: 'ja', name: 'Japanese' }
const config = {
  maxItemsPerRequest: 40,
  maxSourceCharsPerRequest: 6000,
  requestConcurrency: 2,
  maxTranslationRounds: 3
}

function completion(
  content: string,
  finishReason: 'stop' | 'length' = 'stop'
): Response {
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
          finish_reason: finishReason
        }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

function translatorFor(
  respond: (body: string, call: number) => Response | Promise<Response>
) {
  let calls = 0
  const fetchFn: typeof fetch = async (_input, init) => {
    calls++
    return respond(typeof init?.body === 'string' ? init.body : '', calls)
  }
  const translate = createOpenAiTranslator({
    apiKey: 'test-key',
    model: 'gpt-5.6-terra',
    reasoningEffort: 'high',
    glossary: '',
    maxTruncationSplitDepth: 2,
    fetchFn
  })
  return { translate, callCount: () => calls }
}

describe('translateItems', () => {
  it('returns translations that pass token validation', async () => {
    const items: TranslationItem[] = [
      { id: '1', context: 'ui.copy', source: 'Copy', preserve: [] }
    ]
    const translateBatch: TranslateBatch = vi.fn(async () => ({
      '1': 'コピー'
    }))

    const results = await translateItems(locale, items, translateBatch, config)

    expect(results.get('1')).toBe('コピー')
  })

  it('retries an item whose translation drops a protected tag', async () => {
    const items: TranslationItem[] = [
      {
        id: '1',
        context: 'ui.readMore',
        source: 'Read <strong>more</strong>',
        preserve: ['<strong>', '</strong>']
      }
    ]
    let call = 0
    const translateBatch: TranslateBatch = vi.fn(async () => {
      call++
      return call === 1
        ? { '1': 'もっと見る' }
        : { '1': '<strong>もっと見る</strong>' }
    })

    const results = await translateItems(locale, items, translateBatch, config)

    expect(results.get('1')).toBe('<strong>もっと見る</strong>')
    expect(translateBatch).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting every retry round', async () => {
    const items: TranslationItem[] = [
      { id: '1', context: 'ui.copy', source: 'Copy', preserve: [] }
    ]
    const translateBatch: TranslateBatch = vi.fn(async () => ({}))

    await expect(
      translateItems(locale, items, translateBatch, config)
    ).rejects.toThrow(/failed for 1 strings/)
    expect(translateBatch).toHaveBeenCalledTimes(config.maxTranslationRounds)
  })
})

describe('createOpenAiTranslator', () => {
  const items: TranslationItem[] = [
    { id: '1', context: 'ui.copy', source: 'Copy', preserve: [] }
  ]

  it('parses a successful completion response', async () => {
    const { translate } = translatorFor(() => completion('{"1": "コピー"}'))

    await expect(translate(locale, items)).resolves.toEqual({ '1': 'コピー' })
  })

  it('returns immediately without a request for an empty batch', async () => {
    const { translate, callCount } = translatorFor(() => completion('{}'))

    await expect(translate(locale, [])).resolves.toEqual({})
    expect(callCount()).toBe(0)
  })

  it('retries once on a malformed JSON response, then succeeds', async () => {
    const { translate, callCount } = translatorFor((_body, call) =>
      call === 1 ? completion('not json') : completion('{"1": "コピー"}')
    )

    await expect(translate(locale, items)).resolves.toEqual({ '1': 'コピー' })
    expect(callCount()).toBe(2)
  })

  it('defers a single string whose translation keeps truncating', async () => {
    const { translate } = translatorFor(() => completion('{"1": "コ', 'length'))

    await expect(translate(locale, items)).resolves.toEqual({})
  })

  it('does not fan out requests while splitting a truncated batch', async () => {
    const twoItems: TranslationItem[] = [
      { id: '1', context: 'ui.copy', source: 'Copy', preserve: [] },
      { id: '2', context: 'ui.readMore', source: 'Read more', preserve: [] }
    ]
    let activeRequests = 0
    let peakRequests = 0
    const { translate } = translatorFor(async (body, call) => {
      if (call === 1) return completion('{"1": "コ', 'length')
      activeRequests++
      peakRequests = Math.max(peakRequests, activeRequests)
      await Promise.resolve()
      activeRequests--
      return body.includes('ui.copy')
        ? completion('{"1": "コピー"}')
        : completion('{"2": "続きを見る"}')
    })

    await expect(translate(locale, twoItems)).resolves.toEqual({
      '1': 'コピー',
      '2': '続きを見る'
    })
    expect(peakRequests).toBe(1)
  })
})
