import OpenAI from 'openai'

import type { OutputLocale, TranslationPipelineConfig } from './config'
import { tokenErrors } from './protected-tokens'

export interface TranslationItem {
  id: string
  context: string
  source: string
  preserve: string[]
  retryNote?: string
}

export type TranslateBatch = (
  locale: OutputLocale,
  items: TranslationItem[]
) => Promise<Record<string, string>>

const maxNetworkRetries = 3
const maxMalformedResponseRetries = 1

// Mirrors the request pool in the app's own scripts/i18n/translate.ts: stop
// dispatching once any task fails so a fatal error does not keep spending API
// requests whose results nobody will consume; in-flight tasks settle before
// the first failure is rethrown so no work outlives the call.
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  let firstFailure: { reason: unknown } | undefined
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (!firstFailure && next < items.length) {
        const index = next++
        try {
          results[index] = await task(items[index])
        } catch (error) {
          firstFailure ??= { reason: error }
        }
      }
    }
  )
  await Promise.all(workers)
  if (firstFailure) throw firstFailure.reason
  return results
}

function chunkItems(
  items: readonly TranslationItem[],
  maxItems: number,
  maxSourceChars: number
): TranslationItem[][] {
  const chunks: TranslationItem[][] = []
  let chunk: TranslationItem[] = []
  let chunkChars = 0
  for (const item of items) {
    const itemChars = item.source.length
    if (
      chunk.length > 0 &&
      (chunk.length >= maxItems || chunkChars + itemChars > maxSourceChars)
    ) {
      chunks.push(chunk)
      chunk = []
      chunkChars = 0
    }
    chunk.push(item)
    chunkChars += itemChars
  }
  if (chunk.length > 0) chunks.push(chunk)
  return chunks
}

function buildSystemPrompt(locale: OutputLocale, glossary: string): string {
  return `You are a professional localization translator for ComfyUI's marketing website (comfy.org).
Translate each item's "source" string from English into ${locale.name}.

Rules:
- Respond with a JSON object that maps every item "id" to its translated string — every id, no other keys, no commentary.
- Every substring listed in an item's "preserve" array must appear in the translation exactly as written, byte for byte. Never translate, transliterate, or renumber them.
- Interpolation placeholders such as {name} and HTML tags such as <strong> stay exactly as written.
- The "context" field is the key of the string in the website's translation map; use it to resolve ambiguity.
- Match the brevity and confident, non-overclaiming tone of the source.

${glossary}
${locale.guidance ? `\n${locale.name} guidelines:\n${locale.guidance}\n` : ''}`
}

function parseBatchResponse(
  content: string,
  requestedIds: ReadonlySet<string>
): Record<string, string> {
  const parsed: unknown = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('translation response is not a JSON object')
  }
  const record: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && requestedIds.has(key)) record[key] = value
  }
  return record
}

export interface RequestCounter {
  fetch: typeof fetch
  requestCount: () => number
}

export function createRequestCounter(
  fetchFn: typeof fetch = globalThis.fetch
): RequestCounter {
  let requests = 0
  const countingFetch: typeof fetch = async (input, init) => {
    requests++
    return fetchFn(input, init)
  }
  return { fetch: countingFetch, requestCount: () => requests }
}

function splitTruncatedBatch(items: TranslationItem[]): TranslationItem[][] {
  const totalChars = items.reduce((sum, item) => sum + item.source.length, 0)
  return chunkItems(
    items,
    Math.ceil(items.length / 2),
    Math.ceil(totalChars / 2)
  )
}

interface OpenAiTranslatorOptions {
  apiKey: string
  model: string
  reasoningEffort: TranslationPipelineConfig['reasoningEffort']
  glossary: string
  maxTruncationSplitDepth: number
  fetchFn?: typeof fetch
  onCompletion?: (completion: OpenAI.ChatCompletion) => void
}

export function createOpenAiTranslator(
  options: OpenAiTranslatorOptions
): TranslateBatch {
  const client = new OpenAI({
    apiKey: options.apiKey,
    fetch: options.fetchFn,
    maxRetries: maxNetworkRetries
  })

  async function translateBatch(
    locale: OutputLocale,
    items: TranslationItem[],
    splitDepth: number
  ): Promise<Record<string, string>> {
    if (items.length === 0) return {}
    const requestedIds = new Set(items.map((item) => item.id))
    let deferralReason = 'the request was not attempted'
    for (let attempt = 0; attempt <= maxMalformedResponseRetries; attempt++) {
      const completion = await client.chat.completions.create({
        model: options.model,
        reasoning_effort: options.reasoningEffort,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(locale, options.glossary)
          },
          { role: 'user', content: JSON.stringify({ items }) }
        ]
      })
      options.onCompletion?.(completion)
      const choice = completion.choices[0]
      if (choice?.finish_reason === 'length') {
        if (items.length === 1) {
          deferralReason = `the response was truncated (finish_reason "length") for the single string ${items[0].context}`
          continue
        }
        if (splitDepth >= options.maxTruncationSplitDepth) {
          deferralReason = `${items.length} strings were still truncated (finish_reason "length") at maxTruncationSplitDepth ${options.maxTruncationSplitDepth}`
          break
        }
        // Sequential, not Promise.all: this call is already one of
        // requestConcurrency workers, so fanning its children out in
        // parallel would let a truncated batch exceed that limit.
        const merged: Record<string, string> = {}
        for (const chunk of splitTruncatedBatch(items)) {
          Object.assign(
            merged,
            await translateBatch(locale, chunk, splitDepth + 1)
          )
        }
        return merged
      }
      const content = choice?.message?.content
      if (typeof content !== 'string') {
        deferralReason = 'the response has no message content'
        continue
      }
      try {
        return parseBatchResponse(content, requestedIds)
      } catch (error) {
        deferralReason = error instanceof Error ? error.message : String(error)
      }
    }
    console.warn(
      `${locale.code}: deferring ${items.length} strings for retry: ${deferralReason}`
    )
    return {}
  }

  return (locale, items) => translateBatch(locale, items, 0)
}

export async function translateItems(
  locale: OutputLocale,
  items: readonly TranslationItem[],
  translateBatch: TranslateBatch,
  config: Pick<
    TranslationPipelineConfig,
    | 'maxItemsPerRequest'
    | 'maxSourceCharsPerRequest'
    | 'requestConcurrency'
    | 'maxTranslationRounds'
  >
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  let remaining = [...items]

  for (
    let round = 0;
    round < config.maxTranslationRounds && remaining.length > 0;
    round++
  ) {
    const chunks = chunkItems(
      remaining,
      config.maxItemsPerRequest,
      config.maxSourceCharsPerRequest
    )
    const responses = await mapWithConcurrency(
      chunks,
      config.requestConcurrency,
      async (chunk) => {
        const requested = new Set(chunk.map((item) => item.id))
        const response = await translateBatch(locale, chunk)
        return Object.entries(response).filter(([id]) => requested.has(id))
      }
    )
    const translated = new Map(responses.flat())

    const failed: TranslationItem[] = []
    for (const item of remaining) {
      const value = translated.get(item.id)
      const errors =
        value === undefined
          ? ['no translation returned']
          : tokenErrors(item.source, value)
      if (value !== undefined && errors.length === 0) {
        results.set(item.id, value)
      } else {
        failed.push({
          ...item,
          retryNote: `A previous attempt was rejected (${errors.join('; ')}). Reproduce every "preserve" substring exactly as written.`
        })
      }
    }
    remaining = failed
  }

  if (remaining.length > 0) {
    const details = remaining
      .map((item) => `  ${item.context}`)
      .slice(0, 20)
      .join('\n')
    throw new Error(
      `Translation into ${locale.code} failed for ${remaining.length} strings after ${config.maxTranslationRounds} attempts:\n${details}`
    )
  }
  return results
}
