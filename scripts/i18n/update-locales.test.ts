/**
 * The OpenAI client refuses to construct in browser-like environments
 * (happy-dom defines window/navigator), and nothing here needs a DOM.
 * @vitest-environment node
 */
import type { Response as OpenAiResponse } from 'openai/resources/responses/responses'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OutputLocale } from './config'
import type { LocaleObject } from './locale-tree'
import {
  collectPendingLeaves,
  diffLocaleSources,
  getLeaf,
  pathKey,
  rebuildLocale
} from './locale-tree'
import { leafTokensDiffer, validateLocale } from './protected-tokens'
import type { TranslateBatch, TranslationItem } from './translate'
import {
  chunkItems,
  createOpenAiTranslator,
  createRequestCounter,
  mapWithConcurrency,
  translateLocaleItems
} from './translate'
import {
  assembleLeafTranslations,
  buildTranslationItems,
  formatPruneSummary,
  formatUsageSummary,
  resolveTargetConfig
} from './update-locales'

const locale: OutputLocale = { code: 'xx', name: 'Test Language' }

const translationConfig = {
  maxItemsPerRequest: 2,
  maxSourceCharsPerRequest: 1000,
  requestConcurrency: 1,
  maxTranslationRounds: 3,
  strictProtectedTokens: false
}

const echoTranslator: TranslateBatch = (batchLocale, items) =>
  Promise.resolve(
    Object.fromEntries(
      items.map((item) => [item.id, `${batchLocale.code}: ${item.source}`])
    )
  )

async function updateLocaleFile(
  source: LocaleObject,
  previous: LocaleObject,
  existing: LocaleObject,
  translateBatch: TranslateBatch
): Promise<{ output: LocaleObject; translatedCount: number }> {
  const changes = diffLocaleSources(previous, source)
  const invalidated = new Set(
    [...changes.added, ...changes.modified].map(pathKey)
  )
  const pendingLeaves = collectPendingLeaves(
    source,
    existing,
    invalidated,
    leafTokensDiffer
  )
  const plan = buildTranslationItems('main.json', pendingLeaves)
  const translations =
    plan.items.length > 0
      ? await translateLocaleItems(
          locale,
          plan.items,
          translateBatch,
          translationConfig
        )
      : new Map<string, string>()
  const output = rebuildLocale(
    source,
    existing,
    invalidated,
    assembleLeafTranslations(pendingLeaves, plan, translations)
  )
  expect(validateLocale(source, output, changes)).toEqual([])
  return { output, translatedCount: plan.items.length }
}

describe('diffLocaleSources', () => {
  it('reports added, modified, and deleted leaf paths', () => {
    const changes = diffLocaleSources(
      { changed: 'Old {plan}', deleted: 'Delete me', stable: 'Keep me' },
      { added: 'New string', changed: 'New {plan}', stable: 'Keep me' }
    )
    expect(changes).toEqual({
      added: [['added']],
      deleted: [['deleted']],
      modified: [['changed']]
    })
  })
})

describe('locale file update', () => {
  const previous = {
    changed: 'Old {plan}',
    deleted: 'Delete me',
    nested: { count: 42, note: 'A note' },
    stable: 'Keep me'
  }
  const source = {
    added: 'New {from} and {to}',
    changed: 'New {plan}',
    list: ['First cause', '', 'Third cause'],
    nested: { count: 42, note: 'A note' },
    protected:
      "Use <Picture i>, <Video k>, and <Audio j> with 17k+5, 'match', or 'max'.",
    stable: 'Keep me'
  }
  const existing = {
    changed: 'stale translation',
    deleted: 'old translation',
    nested: { count: 42, note: 'translated note' },
    stable: 'translated keep me',
    stray: 'no longer in source'
  }

  it('translates added, modified, and missing values; prunes deleted and stray keys; keeps valid translations', async () => {
    const { output, translatedCount } = await updateLocaleFile(
      source,
      previous,
      existing,
      echoTranslator
    )

    expect(output).toEqual({
      added: 'xx: New {from} and {to}',
      changed: 'xx: New {plan}',
      list: ['xx: First cause', '', 'xx: Third cause'],
      nested: { count: 42, note: 'translated note' },
      protected:
        "xx: Use <Picture i>, <Video k>, and <Audio j> with 17k+5, 'match', or 'max'.",
      stable: 'translated keep me'
    })
    expect(translatedCount).toBe(5)
    expect(Object.keys(output)).toEqual(Object.keys(output).sort())
  })

  it('retranslates existing translations that were corrupted or blanked', async () => {
    const parity = {
      blanked: 'Save',
      farewell: 'Goodbye',
      greeting: 'Hello {name}',
      intact: 'See {docs}'
    }
    const corrupted = {
      blanked: '',
      farewell: 'translated ({count})',
      greeting: 'Bonjour nom',
      intact: 'translated {docs}'
    }
    const { output, translatedCount } = await updateLocaleFile(
      parity,
      parity,
      corrupted,
      echoTranslator
    )
    expect(output).toEqual({
      blanked: 'xx: Save',
      farewell: 'xx: Goodbye',
      greeting: 'xx: Hello {name}',
      intact: 'translated {docs}'
    })
    expect(translatedCount).toBe(3)
  })

  it('preserves keys named __proto__', async () => {
    const protoSource = JSON.parse(
      '{"__proto__": {"label": "Hello"}, "normal": "World"}'
    ) as LocaleObject
    const { output } = await updateLocaleFile(
      protoSource,
      {},
      {},
      echoTranslator
    )
    expect(Object.keys(output)).toEqual(['__proto__', 'normal'])
    expect(getLeaf(output, ['__proto__', 'label'])).toBe('xx: Hello')
    expect(getLeaf(output, ['normal'])).toBe('xx: World')
  })

  it('is idempotent: a rerun translates nothing and leaves the output unchanged', async () => {
    const { output } = await updateLocaleFile(
      source,
      previous,
      existing,
      echoTranslator
    )
    const untouchedTranslator = vi.fn<TranslateBatch>()
    const rerun = await updateLocaleFile(
      source,
      source,
      output,
      untouchedTranslator
    )
    expect(rerun.output).toEqual(output)
    expect(rerun.translatedCount).toBe(0)
    expect(untouchedTranslator).not.toHaveBeenCalled()
  })
})

describe('translateLocaleItems', () => {
  const items: TranslationItem[] = [
    {
      id: '1',
      context: 'main.json: greeting',
      source: 'Hello {name}',
      preserve: ['{name}']
    }
  ]

  it('retries items whose translation corrupts protected tokens', async () => {
    let calls = 0
    const flaky: TranslateBatch = (_batchLocale, batch) => {
      calls++
      return Promise.resolve(
        Object.fromEntries(
          batch.map((item) => [
            item.id,
            calls === 1 ? 'Bonjour name' : 'Bonjour {name}'
          ])
        )
      )
    }
    const translations = await translateLocaleItems(
      locale,
      items,
      flaky,
      translationConfig
    )
    expect(translations.get('1')).toBe('Bonjour {name}')
    expect(calls).toBe(2)
  })

  it('fails after exhausting rounds when tokens stay corrupted', async () => {
    const corrupting: TranslateBatch = (_batchLocale, batch) =>
      Promise.resolve(
        Object.fromEntries(batch.map((item) => [item.id, 'Bonjour name']))
      )
    await expect(
      translateLocaleItems(locale, items, corrupting, translationConfig)
    ).rejects.toThrow(/failed for 1 strings/)
  })

  it('retries empty translations', async () => {
    let calls = 0
    const blankFirst: TranslateBatch = (_batchLocale, batch) => {
      calls++
      return Promise.resolve(
        Object.fromEntries(
          batch.map((item) => [item.id, calls === 1 ? '   ' : 'Bonjour {name}'])
        )
      )
    }
    const translations = await translateLocaleItems(
      locale,
      items,
      blankFirst,
      translationConfig
    )
    expect(translations.get('1')).toBe('Bonjour {name}')
    expect(calls).toBe(2)
  })

  it('dispatches chunks concurrently without exceeding the request limit', async () => {
    const sixItems: TranslationItem[] = ['1', '2', '3', '4', '5', '6'].map(
      (id) => ({
        id,
        context: `main.json: key${id}`,
        source: `Source ${id}`,
        preserve: []
      })
    )
    let inFlight = 0
    let maxInFlight = 0
    const gated: TranslateBatch = async (_batchLocale, batch) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight--
      return Object.fromEntries(batch.map((item) => [item.id, `t${item.id}`]))
    }
    const translations = await translateLocaleItems(locale, sixItems, gated, {
      ...translationConfig,
      requestConcurrency: 2
    })
    expect(translations.size).toBe(6)
    expect(maxInFlight).toBe(2)
  })

  it('ignores response ids that were not requested in the same chunk', async () => {
    const threeItems: TranslationItem[] = ['1', '2', '3'].map((id) => ({
      id,
      context: `main.json: key${id}`,
      source: `Source ${id}`,
      preserve: []
    }))
    const responses: Array<Record<string, string>> = [
      { '1': 'ok1', '2': 'ok2', '3': 'WRONG' },
      {},
      { '3': 'ok3' }
    ]
    let call = 0
    const crossTalking: TranslateBatch = () =>
      Promise.resolve(responses[call++] ?? {})
    const translations = await translateLocaleItems(
      locale,
      threeItems,
      crossTalking,
      translationConfig
    )
    expect(translations.get('3')).toBe('ok3')
  })

  it('sends a retry note naming the violation on later rounds', async () => {
    const seenNotes: Array<string | undefined> = []
    const flaky: TranslateBatch = (_batchLocale, batch) => {
      seenNotes.push(batch[0].retryNote)
      return Promise.resolve(
        Object.fromEntries(
          batch.map((item) => [
            item.id,
            seenNotes.length === 1 ? 'Bonjour {nom}' : 'Bonjour {name}'
          ])
        )
      )
    }
    await translateLocaleItems(locale, items, flaky, translationConfig)
    expect(seenNotes[0]).toBeUndefined()
    expect(seenNotes[1]).toContain('missing {name}')
    expect(seenNotes[1]).toContain('added {nom}')
  })
})

describe('mapWithConcurrency', () => {
  it('stops dispatching new tasks after a failure', async () => {
    const started: number[] = []
    await expect(
      mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
        started.push(item)
        if (item === 1) throw new Error('boom')
        await new Promise((resolve) => setTimeout(resolve, 5))
        return item
      })
    ).rejects.toThrow('boom')
    expect(started).toEqual([1, 2])
  })
})

describe('chunkItems', () => {
  it('splits by item count and source size while keeping oversized items whole', () => {
    const item = (id: string, size: number): TranslationItem => ({
      id,
      context: id,
      source: 'x'.repeat(size),
      preserve: []
    })
    const chunks = chunkItems(
      [item('1', 10), item('2', 10), item('3', 90), item('4', 200)],
      3,
      100
    )
    expect(chunks.map((chunk) => chunk.map(({ id }) => id))).toEqual([
      ['1', '2'],
      ['3'],
      ['4']
    ])
  })
})

describe('validateLocale', () => {
  it('rejects stale modified strings and corrupted protected syntax', () => {
    const previous = { changed: 'Old {plan}' }
    const source = {
      changed: 'New {plan}',
      protected: 'Use <Picture 10> on the 17k+5 grid'
    }
    const changes = diffLocaleSources(previous, source)
    const corrupted = {
      changed: 'New plan',
      protected: 'Use <Localized 10> on the 17000+5 grid'
    }
    expect(validateLocale(source, corrupted, changes)).toEqual([
      'protected: missing 17k+5, <Picture 10>',
      'changed: missing {plan}'
    ])
  })

  it('protects positional and literal interpolation placeholders', () => {
    const source = { help: "Ask {'@'}{username} or check {0}" }
    const changes = diffLocaleSources({}, source)
    expect(
      validateLocale(
        source,
        { help: "Demandez à {'@'}{username} ou consultez {0}" },
        changes
      )
    ).toEqual([])
    expect(
      validateLocale(
        source,
        { help: 'Demandez à @username ou consultez 0' },
        changes
      )
    ).toEqual(["help: missing {'@'}, {0}, {username}"])
  })

  it('protects repeated tokens and HTML markup', () => {
    const source = {
      help: `<a class="link" href="mailto:support@comfy.org">Ask {'@'}support or {'@'}sales</a>`
    }
    const changes = diffLocaleSources({}, source)
    const translated = {
      help: `<a class="other" href="mailto:help@comfy.org">Ask {'@'}support</a>`
    }

    expect(validateLocale(source, translated, changes)).toEqual([])
    expect(validateLocale(source, translated, changes, true)).toEqual([
      `help: missing <a class="link" href="mailto:support@comfy.org">, {'@'}`,
      `help: added <a class="other" href="mailto:help@comfy.org">`,
      'help: changed HTML tag sequence'
    ])
  })

  it('flags corruption on unchanged keys, including array leaves', () => {
    const source = {
      list: ['Use {name}', 'Second'],
      status: 'Failed',
      title: 'Hi {name}'
    }
    const changes = diffLocaleSources(source, source)
    expect(
      validateLocale(
        source,
        {
          list: ['Use nom', 'Deuxième'],
          status: '失败 ({count})',
          title: 'Hola nombre'
        },
        changes
      )
    ).toEqual([
      'list.0: missing {name}',
      'status: added {count}',
      'title: missing {name}'
    ])
  })

  it('flags keys that no longer exist in the source', () => {
    const source = { stable: 'Keep me' }
    const changes = diffLocaleSources(source, source)
    expect(
      validateLocale(
        source,
        { stable: 'translated', stray: 'left behind' },
        changes
      )
    ).toEqual(['stray: key does not exist in the source'])
  })

  it('accepts locale quote styles and rejects introduced message syntax', () => {
    const source = { scale: "Set 'match' or 'max' to scale", send: 'Send' }
    const changes = diffLocaleSources({}, source)
    expect(
      validateLocale(
        source,
        { scale: 'Réglez «match» ou „max“ pour l’échelle', send: 'Envoyer' },
        changes
      )
    ).toEqual([])
    expect(
      validateLocale(
        source,
        { scale: source.scale, send: 'Enviar | Cancelar' },
        changes
      )
    ).toEqual(['send: added plural separator |'])
    expect(
      validateLocale(
        source,
        { scale: source.scale, send: 'Enviar @:g.cancel' },
        changes
      )
    ).toEqual(['send: added linked message @'])
  })

  it('compares placeholder counts across plural forms', () => {
    const source = { count: 'No items | {count} item | {count} items' }
    const changes = diffLocaleSources({}, source)
    expect(
      validateLocale(
        source,
        { count: 'None | {count} one | {count} many' },
        changes
      )
    ).toEqual([])
    expect(
      validateLocale(source, { count: 'None | {total} many' }, changes, true)
    ).toEqual(['count: missing {count}, {count}', 'count: added {total}'])
  })
})

describe('resolveTargetConfig', () => {
  it.for([
    {
      argv: ['--check'],
      entry: 'src/locales/en',
      output: 'src/locales',
      locales: [
        'zh',
        'zh-TW',
        'ru',
        'ja',
        'ko',
        'fr',
        'es',
        'ar',
        'tr',
        'pt-BR',
        'fa',
        'he',
        'it',
        'de'
      ]
    },
    {
      argv: ['--target', 'website', '--check'],
      entry: 'apps/website/src/locales/en',
      output: 'apps/website/src/locales',
      locales: ['zh-CN', 'ja']
    },
    {
      argv: ['--target=website', '--check'],
      entry: 'apps/website/src/locales/en',
      output: 'apps/website/src/locales',
      locales: ['zh-CN', 'ja']
    }
  ])('selects the catalogs for $argv', ({ argv, entry, output, locales }) => {
    const config = resolveTargetConfig(argv)
    expect(config.entry).toBe(entry)
    expect(config.output).toBe(output)
    expect(config.outputLocales.map(({ code }) => code)).toEqual(locales)
  })

  it.for([['--target', 'docs'], ['--target']])('rejects %s', (argv) => {
    expect(() => resolveTargetConfig(argv)).toThrow(
      'Unknown translation target'
    )
  })
})

describe('formatPruneSummary', () => {
  it('reports all source deletions without blocking on their size', () => {
    expect(formatPruneSummary('main.json', 0, 100)).toBeUndefined()
    expect(formatPruneSummary('main.json', 1, 100)).toBe(
      'WARNING: main.json: 1 of 100 English keys deleted; matching locale keys will be pruned.'
    )
    expect(formatPruneSummary('nodeDefs.json', 387, 9082)).toBe(
      'WARNING: nodeDefs.json: 387 of 9082 English keys deleted; matching locale keys will be pruned.'
    )
  })
})

describe('formatUsageSummary', () => {
  it('sums usage across responses and tolerates missing fields', () => {
    expect(
      formatUsageSummary(
        [
          {
            input_tokens: 10,
            output_tokens: 4,
            total_tokens: 14,
            output_tokens_details: { reasoning_tokens: 2 }
          },
          undefined,
          { total_tokens: 100 }
        ],
        7
      )
    ).toBe(
      'OpenAI usage: 7 HTTP requests for 3 responses; 10 input, 4 output (2 reasoning), 114 total tokens.'
    )
  })
})

describe('createOpenAiTranslator', () => {
  const items: TranslationItem[] = [
    {
      id: '1',
      context: 'main.json: greeting',
      source: 'Hello {name}',
      preserve: ['{name}']
    },
    {
      id: '2',
      context: 'main.json: farewell',
      source: 'Goodbye {name}',
      preserve: ['{name}']
    }
  ]

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  function response(
    content: string,
    overrides: Partial<OpenAiResponse> = {}
  ): Response {
    const body = {
      object: 'response',
      status: 'completed',
      error: null,
      incomplete_details: null,
      output: [
        { id: 'reasoning', type: 'reasoning', summary: [] },
        {
          id: 'message',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: content, annotations: [] }]
        }
      ],
      ...overrides
    } satisfies Partial<OpenAiResponse>
    return jsonResponse(body)
  }

  const truncated: Partial<OpenAiResponse> = {
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' }
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  function translatorFor(
    respond: Response[] | ((body: string, call: number) => Response),
    overrides: Partial<
      Pick<
        Parameters<typeof createOpenAiTranslator>[0],
        | 'maxTruncationSplitDepth'
        | 'onUsage'
        | 'translationContext'
        | 'glossary'
      >
    > = {}
  ) {
    let calls = 0
    const requestBodies: string[] = []
    const requestUrls: string[] = []
    const fetchFn: typeof fetch = async (input, init) => {
      requestUrls.push(new Request(input, init).url)
      if (typeof init?.body !== 'string') {
        throw new Error('expected a JSON request body')
      }
      requestBodies.push(init.body)
      calls++
      const response = Array.isArray(respond)
        ? respond.at(calls - 1)
        : respond(init.body, calls)
      if (!response) {
        throw new Error(`no scripted response for request ${calls}`)
      }
      return response
    }
    const translate = createOpenAiTranslator({
      apiKey: 'key',
      model: 'test-model',
      reasoningEffort: 'low',
      translationContext: 'a test application',
      glossary: '',
      maxTruncationSplitDepth: 3,
      fetchFn,
      ...overrides
    })
    return { translate, callCount: () => calls, requestBodies, requestUrls }
  }

  it('splits a truncated batch and scopes each half to its own items', async () => {
    const { translate, callCount, requestBodies } = translatorFor(
      (body, call) => {
        if (call === 1) return response('{"1": "Bonj', truncated)
        return body.includes('main.json: greeting')
          ? response('{"1": "Bonjour {name}"}')
          : response('{"2": "Au revoir {name}"}')
      }
    )
    await expect(translate(locale, items)).resolves.toEqual({
      '1': 'Bonjour {name}',
      '2': 'Au revoir {name}'
    })
    expect(callCount()).toBe(3)
    const halves = requestBodies.slice(1)
    expect(
      halves.some(
        (body) =>
          body.includes('main.json: greeting') &&
          !body.includes('main.json: farewell')
      )
    ).toBe(true)
    expect(
      halves.some(
        (body) =>
          body.includes('main.json: farewell') &&
          !body.includes('main.json: greeting')
      )
    ).toBe(true)
  })

  it('defers a single string whose translation keeps truncating', async () => {
    const { translate, callCount } = translatorFor([
      response('{"1": "Bonj', truncated),
      response('{"1": "Bonj', truncated)
    ])
    await expect(translate(locale, items.slice(0, 1))).resolves.toEqual({})
    expect(callCount()).toBe(2)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('main.json: greeting')
    )
  })

  it('defers a batch that keeps truncating at the split depth', async () => {
    const wide = ['a', 'b', 'c', 'd'].map((name, index) => ({
      id: String(index),
      context: `main.json: ${name}`,
      source: name,
      preserve: []
    }))
    const { translate, callCount } = translatorFor(
      Array.from({ length: 8 }, () => response('{"0": "Bonj', truncated)),
      { maxTruncationSplitDepth: 1 }
    )
    await expect(translate(locale, wide)).resolves.toEqual({})
    expect(callCount()).toBe(3)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('maxTruncationSplitDepth 1')
    )
  })

  it('counts every request made through the counting fetch', async () => {
    const counter = createRequestCounter(async () => response('{}'))
    await counter.fetch('https://example.test')
    await counter.fetch('https://example.test')
    expect(counter.requestCount()).toBe(2)
  })

  it.for([
    { name: 'invalid JSON', content: 'not json' },
    { name: 'non-string values', content: '{"1":"Bonjour {name}","2":42}' },
    { name: 'missing keys', content: '{"1":"Bonjour {name}"}' },
    {
      name: 'unexpected keys',
      content: '{"1":"Bonjour {name}","2":"Au revoir {name}","3":"stray"}'
    }
  ])('defers $name after one retry', async ({ content }) => {
    const { translate, callCount } = translatorFor([
      response(content),
      response(content)
    ])
    await expect(translate(locale, items)).resolves.toEqual({})
    expect(callCount()).toBe(2)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('deferring 2 strings for retry')
    )
  })

  it.for([
    { name: 'invalid JSON', content: 'not json' },
    { name: 'missing keys', content: '{"1":"Bonjour {name}"}' }
  ])(
    'recovers from $name and counts usage for both attempts',
    async ({ content }) => {
      const usages: OpenAiResponse['usage'][] = []
      const usage = {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 2 }
      }
      const { translate, callCount } = translatorFor(
        [
          response(content, { usage }),
          response('{"1":"Bonjour {name}","2":"Au revoir {name}"}', { usage })
        ],
        { onUsage: (usage) => usages.push(usage) }
      )
      await expect(translate(locale, items)).resolves.toEqual({
        '1': 'Bonjour {name}',
        '2': 'Au revoir {name}'
      })
      expect(formatUsageSummary(usages, callCount())).toBe(
        'OpenAI usage: 2 HTTP requests for 2 responses; 20 input, 8 output (4 reasoning), 28 total tokens.'
      )
    }
  )

  it('recovers from malformed HTTP JSON and reports unavailable usage', async () => {
    const usages: OpenAiResponse['usage'][] = []
    const usage = {
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 2 }
    }
    const { translate, callCount } = translatorFor(
      [
        new Response('{', {
          headers: { 'content-type': 'application/json' }
        }),
        response('{"1":"Bonjour {name}","2":"Au revoir {name}"}', { usage })
      ],
      { onUsage: (usage) => usages.push(usage) }
    )
    await expect(translate(locale, items)).resolves.toEqual({
      '1': 'Bonjour {name}',
      '2': 'Au revoir {name}'
    })
    expect(usages).toEqual([undefined, usage])
    expect(callCount()).toBe(2)
  })

  it('defers malformed HTTP JSON after one retry', async () => {
    const { translate, callCount } = translatorFor(
      () =>
        new Response('{', {
          headers: { 'content-type': 'application/json' }
        })
    )
    await expect(translate(locale, items)).resolves.toEqual({})
    expect(callCount()).toBe(2)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('deferring 2 strings for retry')
    )
  })

  it.for([
    { name: 'a null envelope', body: null },
    {
      name: 'missing output',
      body: { object: 'response', status: 'completed' }
    },
    {
      name: 'null output',
      body: { object: 'response', status: 'completed', output: null }
    },
    {
      name: 'missing message content',
      body: {
        object: 'response',
        status: 'completed',
        output: [{ type: 'message' }]
      }
    }
  ])('recovers from $name within the request budget', async ({ body }) => {
    const { translate, callCount } = translatorFor([
      jsonResponse(body),
      response('{"1":"Bonjour {name}","2":"Au revoir {name}"}')
    ])
    await expect(translate(locale, items)).resolves.toEqual({
      '1': 'Bonjour {name}',
      '2': 'Au revoir {name}'
    })
    expect(callCount()).toBe(2)
  })

  it('defers persistently malformed envelopes after one retry and retains usage', async () => {
    const usage = {
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 2 }
    }
    const onUsage = vi.fn()
    const { translate, callCount } = translatorFor(
      () => jsonResponse({ status: 'completed', output: null, usage }),
      { onUsage }
    )
    await expect(translate(locale, items)).resolves.toEqual({})
    expect(callCount()).toBe(2)
    expect(onUsage.mock.calls).toEqual([[usage], [usage]])
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid response envelope')
    )
  })

  it.for([
    { name: 'a string input count', invalid: { input_tokens: '10' } },
    { name: 'a negative output count', invalid: { output_tokens: -1 } },
    { name: 'a fractional total', invalid: { total_tokens: 14.5 } },
    {
      name: 'an invalid reasoning count',
      invalid: { output_tokens_details: { reasoning_tokens: '2' } }
    }
  ])(
    'retries usage with $name without corrupting totals',
    async ({ invalid }) => {
      const usage = {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 2 }
      }
      const usages: OpenAiResponse['usage'][] = []
      const { translate, callCount } = translatorFor(
        [
          new Response(
            JSON.stringify({
              object: 'response',
              status: 'completed',
              output: [],
              usage: { ...usage, ...invalid }
            }),
            { headers: { 'content-type': 'application/json' } }
          ),
          response('{"1":"Bonjour {name}","2":"Au revoir {name}"}', { usage })
        ],
        { onUsage: (usage) => usages.push(usage) }
      )
      await expect(translate(locale, items)).resolves.toEqual({
        '1': 'Bonjour {name}',
        '2': 'Au revoir {name}'
      })
      expect(usages).toEqual([undefined, usage])
      expect(formatUsageSummary(usages, callCount())).toBe(
        'OpenAI usage: 2 HTTP requests for 2 responses; 10 input, 4 output (2 reasoning), 14 total tokens.'
      )
    }
  )

  it('defers persistently invalid usage after one retry', async () => {
    const onUsage = vi.fn()
    const { translate, callCount } = translatorFor(
      () =>
        new Response(
          JSON.stringify({
            object: 'response',
            status: 'completed',
            output: [],
            usage: 'invalid'
          }),
          { headers: { 'content-type': 'application/json' } }
        ),
      { onUsage }
    )
    await expect(translate(locale, items)).resolves.toEqual({})
    expect(callCount()).toBe(2)
    expect(onUsage.mock.calls).toEqual([[undefined], [undefined]])
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid token usage')
    )
  })

  it.for([
    {
      status: 'completed',
      error: null,
      expected: { '1': 'Bonjour {name}', '2': 'Au revoir {name}' }
    },
    {
      status: 'failed',
      error: { code: 'server_error', message: 'Generation failed' },
      expected: {}
    }
  ] satisfies {
    status: OpenAiResponse['status']
    error: OpenAiResponse['error']
    expected: Record<string, string>
  }[])(
    'retries a server error once before a $status response',
    async ({ status, error, expected }) => {
      const failed = {
        status: 'failed',
        error: { code: 'server_error', message: 'Generation failed' }
      } satisfies Partial<OpenAiResponse>
      const { translate, callCount } = translatorFor([
        response('', failed),
        response('{"1":"Bonjour {name}","2":"Au revoir {name}"}', {
          status,
          error
        })
      ])
      await expect(translate(locale, items)).resolves.toEqual(expected)
      expect(callCount()).toBe(2)
    }
  )

  it('accepts a successful response without a status', async () => {
    const { translate, callCount } = translatorFor(() =>
      response('{"1":"Bonjour {name}","2":"Au revoir {name}"}', {
        status: undefined
      })
    )
    await expect(translate(locale, items)).resolves.toEqual({
      '1': 'Bonjour {name}',
      '2': 'Au revoir {name}'
    })
    expect(callCount()).toBe(1)
  })

  it.for([
    {
      name: 'content filtering',
      overrides: {
        status: 'incomplete',
        incomplete_details: { reason: 'content_filter' }
      }
    },
    {
      name: 'an incomplete response without a reason',
      overrides: { status: 'incomplete', incomplete_details: null }
    },
    {
      name: 'an incomplete response with empty details',
      overrides: { status: 'incomplete', incomplete_details: {} }
    },
    {
      name: 'a permanent failure',
      overrides: {
        status: 'failed',
        error: { code: 'invalid_prompt', message: 'Invalid input' }
      }
    },
    {
      name: 'a refusal',
      overrides: {
        output: [
          {
            id: 'refusal',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              { type: 'refusal', refusal: 'Cannot translate this input' }
            ]
          }
        ]
      }
    },
    {
      name: 'a refusal alongside valid translations',
      overrides: {
        output: [
          {
            id: 'refusal',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              { type: 'refusal', refusal: 'Cannot translate this input' },
              {
                type: 'output_text',
                text: '{"1":"Bonjour {name}","2":"Au revoir {name}"}',
                annotations: []
              }
            ]
          }
        ]
      }
    },
    {
      name: 'a refusal alongside malformed JSON',
      overrides: {
        output: [
          {
            id: 'refusal',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              { type: 'refusal', refusal: 'Cannot translate this input' },
              { type: 'output_text', text: 'not json', annotations: [] }
            ]
          }
        ]
      }
    }
  ] satisfies { name: string; overrides: Partial<OpenAiResponse> }[])(
    'defers $name without accepting output text',
    async ({ overrides }) => {
      const usage = {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 2 }
      }
      const onUsage = vi.fn()
      const { translate, callCount } = translatorFor(
        () =>
          response('{"1":"Bonjour {name}","2":"Au revoir {name}"}', {
            ...overrides,
            usage
          }),
        { onUsage }
      )
      await expect(translate(locale, items)).resolves.toEqual({})
      expect(callCount()).toBe(1)
      expect(onUsage).toHaveBeenCalledExactlyOnceWith(usage)
    }
  )

  it('defers a response with no output text', async () => {
    const { translate, callCount } = translatorFor([
      response('', { output: [] }),
      response('', { output: [] })
    ])
    await expect(translate(locale, items)).resolves.toEqual({})
    expect(callCount()).toBe(2)
  })

  it.for([
    {
      name: 'JSON split across text parts',
      messages: [['{"1":"Bonjour {name}",', '"2":"Au revoir {name}"}']],
      expected: { '1': 'Bonjour {name}', '2': 'Au revoir {name}' },
      calls: 1
    },
    {
      name: 'JSON split across messages',
      messages: [['{"1":"Bonjour {name}",'], ['"2":"Au revoir {name}"}']],
      expected: { '1': 'Bonjour {name}', '2': 'Au revoir {name}' },
      calls: 1
    },
    {
      name: 'conflicting JSON documents',
      messages: [
        [
          '{"1":"Bonjour {name}","2":"Au revoir {name}"}',
          '{"1":"Salut {name}","2":"Adieu {name}"}'
        ]
      ],
      expected: {},
      calls: 2
    }
  ])(
    'validates $name as one translation result',
    async ({ messages, expected, calls }) => {
      const { translate, callCount } = translatorFor(() =>
        response('', {
          output: messages.map((parts, index) => ({
            type: 'message',
            id: `message-${index}`,
            role: 'assistant',
            status: 'completed',
            content: parts.map((text) => ({
              type: 'output_text',
              text,
              annotations: []
            }))
          }))
        })
      )
      await expect(translate(locale, items)).resolves.toEqual(expected)
      expect(callCount()).toBe(calls)
    }
  )

  it.for(['1', 'pricing.hero.title'])(
    'requests and parses strict structured output for key %s',
    async (id) => {
      const batch = [{ ...items[0], id }]
      const translated = { [id]: 'Bonjour {name}' }
      const glossary = 'Keep ComfyUI untranslated.'
      const targetLocale = { ...locale, guidance: 'Use a formal tone.' }
      const { translate, requestBodies, requestUrls } = translatorFor(
        [response(JSON.stringify(translated))],
        { glossary }
      )
      await expect(translate(targetLocale, batch)).resolves.toEqual(translated)
      expect(requestUrls).toEqual(['https://api.openai.com/v1/responses'])
      const request: unknown = JSON.parse(requestBodies[0])
      expect(request).toMatchObject({
        model: 'test-model',
        reasoning: { effort: 'low' },
        store: false,
        instructions: expect.stringContaining(targetLocale.name),
        input: JSON.stringify({ items: batch }),
        text: {
          format: {
            type: 'json_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: { [id]: { type: 'string' } },
              required: [id],
              additionalProperties: false
            }
          }
        }
      })
      expect(request).toMatchObject({
        instructions: expect.stringContaining(glossary)
      })
      expect(request).toMatchObject({
        instructions: expect.stringContaining('a test application')
      })
      expect(request).toMatchObject({
        instructions: expect.stringContaining(targetLocale.guidance)
      })
      expect(request).toMatchObject({
        instructions: expect.stringContaining(
          'preserve substring byte for byte'
        )
      })
    }
  )

  it('reports usage for truncated and successful responses', async () => {
    const totalTokens: number[] = []
    const onUsage = vi.fn((usage: OpenAiResponse['usage']) => {
      if (usage) totalTokens.push(usage.total_tokens)
    })
    const { translate } = translatorFor(
      (body, call) => {
        const greeting = body.includes('main.json: greeting')
        const inputTokens = call === 1 ? 10 : greeting ? 7 : 8
        const outputTokens = call === 1 ? 4 : greeting ? 5 : 6
        return response(
          call === 1
            ? '{"1": "Bonj'
            : greeting
              ? '{"1": "Bonjour {name}"}'
              : '{"2": "Au revoir {name}"}',
          {
            ...(call === 1 ? truncated : {}),
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
              input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 }
            }
          }
        )
      },
      { onUsage }
    )
    await translate(locale, items)
    expect(onUsage).toHaveBeenCalledTimes(3)
    expect(totalTokens[0]).toBe(14)
    expect(totalTokens.slice(1).sort((a, b) => a - b)).toEqual([12, 14])
  })

  it('fails immediately on non-retryable statuses', async () => {
    const { translate, callCount } = translatorFor([
      new Response('bad key', { status: 401 })
    ])
    await expect(translate(locale, items)).rejects.toMatchObject({
      status: 401
    })
    expect(callCount()).toBe(1)
  })

  it('propagates usage callback errors without retrying', async () => {
    const error = new SyntaxError('invalid usage data')
    const { translate, callCount } = translatorFor(
      () => response('{"1":"Bonjour {name}","2":"Au revoir {name}"}'),
      {
        onUsage: () => {
          throw error
        }
      }
    )
    await expect(translate(locale, items)).rejects.toBe(error)
    expect(callCount()).toBe(1)
  })
})
