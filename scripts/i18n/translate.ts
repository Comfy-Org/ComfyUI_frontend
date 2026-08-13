import type {
  OutputLocale,
  ReasoningEffort,
  TranslationPipelineConfig
} from './config'
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

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504])
const retryDelaysMs = [1000, 4000, 10000]
const defaultRequestTimeoutMs = 120_000
const maxRetryAfterMs = 60_000

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, maxRetryAfterMs)
    : 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await task(items[index])
      }
    }
  )
  await Promise.all(workers)
  return results
}

export function chunkItems(
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

export function buildSystemPrompt(
  locale: OutputLocale,
  glossary: string
): string {
  return `You are a professional software localization translator for ComfyUI, a node-based interface for generative AI models.
Translate each item's "source" string from English into ${locale.name}.

Rules:
- Respond with a JSON object that maps every item "id" to its translated string — every id, no other keys, no commentary.
- Every substring listed in an item's "preserve" array must appear in the translation exactly as written, byte for byte. Never translate, transliterate, or renumber them.
- Interpolation placeholders such as {name} stay exactly as written.
- The | character separates plural forms. Keep the same number of forms and translate each form.
- The "context" field is the JSON path of the string in the UI resources; use it to resolve ambiguity. Keep values that are technical identifiers (node type names, parameter names, file names) unchanged when translating them would break meaning.
- Match the brevity and professional tone of the source.

${glossary}
${locale.guidance ? `\n${locale.name} guidelines:\n${locale.guidance}\n` : ''}`
}

function parseBatchResponse(content: string): Record<string, string> {
  const parsed: unknown = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('translation response is not a JSON object')
  }
  const record: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') record[key] = value
  }
  return record
}

interface OpenAiTranslatorOptions {
  apiKey: string
  model: string
  reasoningEffort: ReasoningEffort
  glossary: string
  fetchFn?: typeof fetch
  requestTimeoutMs?: number
}

export function createOpenAiTranslator(
  options: OpenAiTranslatorOptions
): TranslateBatch {
  const fetchFn = options.fetchFn ?? fetch
  const timeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs
  return async (locale, items) => {
    const body = JSON.stringify({
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

    let lastError = new Error('translation request was not attempted')
    let serverRetryDelayMs = 0
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        await sleep(Math.max(retryDelaysMs[attempt - 1], serverRetryDelayMs))
        serverRetryDelayMs = 0
      }
      try {
        const response = await fetchFn(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              'Content-Type': 'application/json'
            },
            body,
            signal: AbortSignal.timeout(timeoutMs)
          }
        )
        if (!response.ok) {
          const detail = await response.text()
          lastError = new Error(
            `OpenAI request failed with status ${response.status}: ${detail.slice(0, 500)}`
          )
          if (!retryableStatuses.has(response.status)) throw lastError
          serverRetryDelayMs = retryAfterMs(response)
          continue
        }
        const payload: unknown = await response.json()
        const choice =
          payload &&
          typeof payload === 'object' &&
          'choices' in payload &&
          Array.isArray(payload.choices)
            ? (payload.choices[0] as unknown)
            : undefined
        const finishReason =
          choice && typeof choice === 'object' && 'finish_reason' in choice
            ? choice.finish_reason
            : undefined
        if (finishReason === 'length') {
          lastError = new Error(
            'OpenAI response was truncated (finish_reason "length"); lower maxItemsPerRequest or maxSourceCharsPerRequest'
          )
          continue
        }
        const message =
          choice && typeof choice === 'object' && 'message' in choice
            ? (choice.message as unknown)
            : undefined
        const content =
          message && typeof message === 'object' && 'content' in message
            ? message.content
            : undefined
        if (typeof content !== 'string') {
          lastError = new Error('OpenAI response has no message content')
          continue
        }
        return parseBatchResponse(content)
      } catch (error) {
        if (error === lastError) throw error
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
    throw lastError
  }
}

export async function translateLocaleItems(
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
          : value.trim().length === 0
            ? ['empty translation']
            : tokenErrors(item.source, value, true)
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
