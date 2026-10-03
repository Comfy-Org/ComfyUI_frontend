import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type {
  Response,
  ResponseUsage
} from 'openai/resources/responses/responses'
import { z } from 'zod'

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

const defaultRequestTimeoutMs = 120_000
const maxNetworkRetries = 3
const maxResponseRetries = 1

const tokenCountSchema = z.number().int().nonnegative()
const responseUsageSchema = z.object({
  input_tokens: tokenCountSchema,
  output_tokens: tokenCountSchema,
  total_tokens: tokenCountSchema,
  input_tokens_details: z.object({
    cached_tokens: tokenCountSchema,
    cache_write_tokens: tokenCountSchema.default(0)
  }),
  output_tokens_details: z.object({ reasoning_tokens: tokenCountSchema })
}) satisfies z.ZodType<ResponseUsage, z.ZodTypeDef, unknown>

const usageEnvelopeSchema = z.object({ usage: responseUsageSchema.nullish() })
const responseMetadataSchema = z.object({
  status: z
    .enum([
      'completed',
      'failed',
      'in_progress',
      'cancelled',
      'queued',
      'incomplete'
    ])
    .optional(),
  error: z
    .object({
      code: z.enum([
        'server_error',
        'rate_limit_exceeded',
        'invalid_prompt',
        'data_residency_mismatch',
        'bio_policy',
        'vector_store_timeout',
        'invalid_image',
        'invalid_image_format',
        'invalid_base64_image',
        'invalid_image_url',
        'image_too_large',
        'image_too_small',
        'image_parse_error',
        'image_content_policy_violation',
        'invalid_image_mode',
        'image_file_too_large',
        'unsupported_image_media_type',
        'empty_image_file',
        'failed_to_download_image',
        'image_file_not_found'
      ]),
      message: z.string()
    })
    .nullable(),
  incomplete_details: z
    .object({
      reason: z.enum(['max_output_tokens', 'content_filter']).optional()
    })
    .nullable()
}) satisfies z.ZodType<
  Pick<Response, 'status' | 'error' | 'incomplete_details'>,
  z.ZodTypeDef,
  unknown
>
const responseEnvelopeSchema = responseMetadataSchema.extend({
  output: z.array(
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('reasoning') }),
      z.object({
        type: z.literal('message'),
        content: z.array(
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('output_text'), text: z.string() }),
            z.object({ type: z.literal('refusal') })
          ])
        )
      })
    ])
  )
})

// Unlike es-toolkit's mapAsync, which dispatches every item up front, this
// pool stops dispatching once any task fails so a fatal error does not keep
// spending API requests whose results nobody will consume; in-flight tasks
// settle before the first failure is rethrown so no work outlives the call
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
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
  translationContext: string,
  glossary: string
): string {
  return `Translate each source from English into ${locale.name} for
${translationContext}. Return each translation under its item's id.

Use context to resolve meaning. Preserve the source's meaning,
tone, and level of detail. Keep code identifiers unchanged.
Reproduce every preserve substring byte for byte. Never translate,
transliterate, or renumber it. Keep interpolation placeholders unchanged.
Retain the number and order of | separated plural forms.

${glossary}
${locale.guidance ? `\n${locale.name} guidelines:\n${locale.guidance}\n` : ''}`
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

type TranslationAttempt =
  | { status: 'translated'; translations: Record<string, string> }
  | { status: 'truncated' }
  | { status: 'retry' | 'defer'; reason: string }

function classifyResponseStatus(
  response: z.infer<typeof responseEnvelopeSchema>
): TranslationAttempt | undefined {
  if (
    response.status === 'incomplete' &&
    response.incomplete_details?.reason === 'max_output_tokens'
  ) {
    return { status: 'truncated' }
  }
  if (response.status !== undefined && response.status !== 'completed') {
    return {
      status:
        response.status === 'failed' && response.error?.code === 'server_error'
          ? 'retry'
          : 'defer',
      reason: `response status ${response.status}: ${JSON.stringify({ error: response.error, incomplete_details: response.incomplete_details })}`
    }
  }
}

function parseTranslationResponse(
  body: unknown,
  schema: z.ZodType<Record<string, string>>
): TranslationAttempt {
  const response = responseEnvelopeSchema.safeParse(body)
  if (!response.success) {
    return { status: 'retry', reason: 'invalid response envelope' }
  }
  const status = classifyResponseStatus(response.data)
  if (status) return status
  const content = response.data.output.flatMap((item) =>
    item.type === 'message' ? item.content : []
  )
  if (content.some((item) => item.type === 'refusal')) {
    return { status: 'defer', reason: 'the model refused the translation' }
  }
  const text = content
    .flatMap((item) => (item.type === 'output_text' ? [item.text] : []))
    .join('')
  return parseTranslationOutput(text, schema)
}

function parseTranslationOutput(
  text: string,
  schema: z.ZodType<Record<string, string>>
): TranslationAttempt {
  let output: unknown
  try {
    output = JSON.parse(text)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return { status: 'retry', reason: error.message }
  }
  const parsed = schema.safeParse(output)
  return parsed.success
    ? { status: 'translated', translations: parsed.data }
    : { status: 'retry', reason: parsed.error.message }
}

interface OpenAiTranslatorOptions {
  apiKey: string
  model: string
  reasoningEffort: TranslationPipelineConfig['reasoningEffort']
  translationContext: string
  glossary: string
  maxTruncationSplitDepth: number
  fetchFn?: typeof fetch
  onUsage?: (usage: ResponseUsage | undefined) => void
  requestTimeoutMs?: number
}

export function createOpenAiTranslator(
  options: OpenAiTranslatorOptions
): TranslateBatch {
  const client = new OpenAI({
    apiKey: options.apiKey,
    fetch: options.fetchFn,
    timeout: options.requestTimeoutMs ?? defaultRequestTimeoutMs,
    maxRetries: maxNetworkRetries
  })

  async function requestTranslation(
    locale: OutputLocale,
    items: TranslationItem[],
    schema: z.ZodType<Record<string, string>>
  ): Promise<TranslationAttempt> {
    const request = client.responses.create({
      model: options.model,
      reasoning: { effort: options.reasoningEffort },
      store: false,
      text: { format: zodTextFormat(schema, 'translations') },
      instructions: buildSystemPrompt(
        locale,
        options.translationContext,
        options.glossary
      ),
      input: JSON.stringify({ items })
    })
    let body: unknown
    try {
      const response = await request.asResponse()
      body = await response.json()
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      options.onUsage?.(undefined)
      return { status: 'retry', reason: error.message }
    }
    const usage = usageEnvelopeSchema.safeParse(body)
    options.onUsage?.(
      usage.success ? (usage.data.usage ?? undefined) : undefined
    )
    if (!usage.success) {
      return { status: 'retry', reason: 'invalid token usage' }
    }
    return parseTranslationResponse(body, schema)
  }

  async function translateBatch(
    locale: OutputLocale,
    items: TranslationItem[],
    splitDepth: number
  ): Promise<Record<string, string>> {
    if (items.length === 0) return {}
    const schema = z
      .object(Object.fromEntries(items.map((item) => [item.id, z.string()])))
      .strict()
    let deferralReason = 'the request was not attempted'
    for (let attempt = 0; attempt <= maxResponseRetries; attempt++) {
      const result = await requestTranslation(locale, items, schema)
      if (result.status === 'translated') return result.translations
      if (result.status !== 'truncated') {
        deferralReason = result.reason
        if (result.status === 'defer') break
        continue
      }
      if (items.length === 1) {
        deferralReason = `the response was truncated (max_output_tokens) for the single string ${items[0].context}`
        continue
      }
      if (splitDepth >= options.maxTruncationSplitDepth) {
        deferralReason = `${items.length} strings were still truncated (max_output_tokens) at maxTruncationSplitDepth ${options.maxTruncationSplitDepth}`
        break
      }
      const settled = await Promise.allSettled(
        splitTruncatedBatch(items).map((chunk) =>
          translateBatch(locale, chunk, splitDepth + 1)
        )
      )
      return Object.fromEntries(
        settled.flatMap((result) => {
          if (result.status === 'rejected') throw result.reason
          return Object.entries(result.value)
        })
      )
    }
    console.warn(
      `${locale.code}: deferring ${items.length} strings for retry: ${deferralReason}`
    )
    return {}
  }

  return (locale, items) => translateBatch(locale, items, 0)
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
    | 'strictProtectedTokens'
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
            : tokenErrors(
                item.source,
                value,
                true,
                config.strictProtectedTokens
              )
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
