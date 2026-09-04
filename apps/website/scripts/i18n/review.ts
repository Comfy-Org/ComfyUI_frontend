import OpenAI from 'openai'

import type { OutputLocale, TranslationPipelineConfig } from './config'

export interface ReviewItem {
  id: string
  context: string
  source: string
  translation: string
}

export interface ReviewVerdict {
  pass: boolean
  reason?: string
}

export type ReviewBatch = (
  locale: OutputLocale,
  items: readonly ReviewItem[]
) => Promise<Map<string, ReviewVerdict>>

function chunkBySize(
  items: readonly ReviewItem[],
  maxItems: number,
  maxChars: number
): ReviewItem[][] {
  const chunks: ReviewItem[][] = []
  let chunk: ReviewItem[] = []
  let chunkChars = 0
  for (const item of items) {
    const itemChars = item.source.length + item.translation.length
    if (
      chunk.length > 0 &&
      (chunk.length >= maxItems || chunkChars + itemChars > maxChars)
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

function buildReviewPrompt(locale: OutputLocale): string {
  return `You are a strict native-${locale.name} reviewer gating machine-translated marketing copy for ComfyUI's website before it ships. Reject anything you would not want a native speaker to see live.

For each item, compare "source" (English) against "translation" (${locale.name}) and reject (pass: false) if any of these hold:
- The translation contains leftover English words that are not established product/technical terms (e.g. ComfyUI, API, GPU, LoRA).
- The translation reads like a literal machine translation rather than natural, professional ${locale.name} marketing copy.
- The translation makes a claim, statistic, or superlative that is not already present in the source.
- Any HTML tag (e.g. <strong>, <a href="...">) or {placeholder} from the source is missing, altered, or reordered in the translation.

Respond with a JSON object mapping every item "id" to {"pass": boolean, "reason": string omitted when pass is true, one short sentence when pass is false}. Judge every id; no commentary outside the JSON object.`
}

interface ReviewerOptions {
  apiKey: string
  model: string
  reasoningEffort: TranslationPipelineConfig['reasoningEffort']
  fetchFn?: typeof fetch
  onCompletion?: (completion: OpenAI.ChatCompletion) => void
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVerdict(value: unknown): value is ReviewVerdict {
  return (
    isPlainRecord(value) &&
    typeof value.pass === 'boolean' &&
    (value.reason === undefined || typeof value.reason === 'string')
  )
}

function parseVerdicts(
  content: string,
  requestedIds: ReadonlySet<string>
): Map<string, ReviewVerdict> {
  const parsed: unknown = JSON.parse(content)
  if (!isPlainRecord(parsed)) {
    throw new Error('review response is not a JSON object')
  }
  const verdicts = new Map<string, ReviewVerdict>()
  for (const [id, value] of Object.entries(parsed)) {
    if (!requestedIds.has(id) || !isVerdict(value)) continue
    verdicts.set(id, {
      pass: value.pass,
      ...(value.reason && value.reason.length > 0
        ? { reason: value.reason }
        : {})
    })
  }
  return verdicts
}

export function createOpenAiReviewer(options: ReviewerOptions): ReviewBatch {
  const client = new OpenAI({
    apiKey: options.apiKey,
    fetch: options.fetchFn,
    maxRetries: 3
  })

  return async (locale, items) => {
    if (items.length === 0) return new Map()
    const requestedIds = new Set(items.map((item) => item.id))
    const completion = await client.chat.completions.create({
      model: options.model,
      reasoning_effort: options.reasoningEffort,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildReviewPrompt(locale) },
        { role: 'user', content: JSON.stringify({ items }) }
      ]
    })
    options.onCompletion?.(completion)
    const content = completion.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error(`${locale.code}: review response has no message content`)
    }
    return parseVerdicts(content, requestedIds)
  }
}

// Items whose review call could not be parsed, or that the model never
// returned a verdict for, are treated as rejected: shipping unreviewed
// machine translation is worse than leaving the English source in place for
// one more pipeline run.
export async function reviewItems(
  locale: OutputLocale,
  items: readonly ReviewItem[],
  reviewBatch: ReviewBatch,
  config: Pick<
    TranslationPipelineConfig,
    'maxItemsPerRequest' | 'maxSourceCharsPerRequest'
  >
): Promise<Map<string, ReviewVerdict>> {
  const chunks = chunkBySize(
    items,
    config.maxItemsPerRequest,
    config.maxSourceCharsPerRequest
  )
  const results = new Map<string, ReviewVerdict>()
  for (const chunk of chunks) {
    let verdicts: Map<string, ReviewVerdict>
    try {
      verdicts = await reviewBatch(locale, chunk)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      verdicts = new Map(
        chunk.map((item) => [item.id, { pass: false, reason }])
      )
    }
    for (const item of chunk) {
      results.set(
        item.id,
        verdicts.get(item.id) ?? {
          pass: false,
          reason: 'reviewer returned no verdict'
        }
      )
    }
  }
  return results
}
