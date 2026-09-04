import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { OutputLocale } from './config'
import { translationPipelineConfig } from './config'
import type {
  BodySegment,
  CustomersFrontmatter,
  DocumentRef,
  FaqFrontmatter,
  TranslatableField
} from './document'
import {
  applyFrontmatterTranslations,
  discoverDocuments,
  findMdxSyntaxErrors,
  joinBody,
  readDocument,
  serializeDocument,
  splitBody,
  translatableFields
} from './document'
import { hashSource, loadManifest, saveManifest } from './manifest'
import type { TranslationManifest } from './manifest'
import { protectedTokens } from './protected-tokens'
import type { ReviewItem } from './review'
import { createOpenAiReviewer, reviewItems } from './review'
import type { TranslationItem } from './translate'
import {
  createOpenAiTranslator,
  createRequestCounter,
  translateItems
} from './translate'

interface PendingDocument {
  ref: DocumentRef
  locale: OutputLocale
  frontmatter: CustomersFrontmatter | FaqFrontmatter
  fields: TranslatableField[]
  body: string
  sourceHash: string
}

// Hashes the full document, including frontmatter fields the pipeline never
// translates (cover, order, section ids): those still get copied through
// into every generated locale file, so an English-only edit to one of them
// must also mark the document pending, or the locale file's copy goes stale
// forever. JSON.stringify (not a delimiter join) keeps the hash injective —
// moving a newline across a field boundary changes the encoding.
function fullDocumentSignature(
  frontmatter: CustomersFrontmatter | FaqFrontmatter,
  body: string
): string {
  return JSON.stringify({ frontmatter, body })
}

function translatableSignature(
  fields: readonly TranslatableField[],
  body: string
): string {
  return JSON.stringify({ fields, body })
}

function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

export function collectPending(
  refs: readonly DocumentRef[],
  manifest: TranslationManifest,
  outputLocales: readonly OutputLocale[]
): {
  pending: PendingDocument[]
  manifestUpdates: Map<string, Map<string, string>>
} {
  const pending: PendingDocument[] = []
  const manifestUpdates = new Map<string, Map<string, string>>()

  for (const ref of refs) {
    const { frontmatter, body } = readDocument(ref, ref.enPath)
    const fields = translatableFields(ref, frontmatter)
    const sourceHash = hashSource(fullDocumentSignature(frontmatter, body))

    for (const locale of outputLocales) {
      const recordedHash = manifest.entries[ref.id]?.[locale.code]

      if (!existsSync(ref.localePath(locale.code))) {
        pending.push({ ref, locale, frontmatter, fields, body, sourceHash })
        continue
      }
      if (recordedHash === undefined) {
        const localeHashes = manifestUpdates.get(ref.id) ?? new Map()
        localeHashes.set(locale.code, sourceHash)
        manifestUpdates.set(ref.id, localeHashes)
        continue
      }
      if (recordedHash !== sourceHash) {
        pending.push({ ref, locale, frontmatter, fields, body, sourceHash })
      }
    }
  }

  return { pending, manifestUpdates }
}

function persistManifest(
  manifestPath: string,
  manifest: TranslationManifest,
  manifestUpdates: ReadonlyMap<string, ReadonlyMap<string, string>>
): void {
  const nextEntries: TranslationManifest['entries'] = { ...manifest.entries }
  for (const [id, locales] of manifestUpdates) {
    nextEntries[id] = { ...nextEntries[id], ...Object.fromEntries(locales) }
  }
  saveManifest(manifestPath, { version: 1, entries: nextEntries })
}

function bodyTranslationItems(
  contextId: string,
  segments: readonly BodySegment[]
): TranslationItem[] {
  return segments.flatMap((segment, index) =>
    segment.translatable
      ? [
          {
            id: `body:${index}`,
            context: `${contextId}: body section ${index}`,
            source: segment.text,
            preserve: protectedTokens(segment.text)
          }
        ]
      : []
  )
}

function assembleBody(
  segments: readonly BodySegment[],
  translations: ReadonlyMap<string, string>
): string {
  return joinBody(
    segments.map((segment, index) =>
      segment.translatable
        ? {
            ...segment,
            text: translations.get(`body:${index}`) ?? segment.text
          }
        : segment
    )
  )
}

// A thrown error means translateItems could not produce a usable result
// after every retry (bad API key, persistent malformed responses) — an
// infrastructure failure, not a quality judgment, so it propagates instead
// of being recorded as a rejection. reviewItems, by contrast, already
// converts its own call failures into `pass: false` verdicts: a review
// service being unreachable is a reason to hold a translation back, not to
// abort the run.
async function translateDocument(
  pending: PendingDocument,
  translateBatch: Parameters<typeof translateItems>[2],
  reviewBatch: Parameters<typeof reviewItems>[2],
  config: typeof translationPipelineConfig
): Promise<
  | { outcome: 'written'; frontmatter: unknown; body: string }
  | { outcome: 'rejected'; reason: string }
> {
  const bodySegments = splitBody(pending.body)
  const items: TranslationItem[] = [
    ...pending.fields.map((field) => ({
      id: field.path,
      context: `${pending.ref.id}: ${field.path}`,
      source: field.value,
      preserve: protectedTokens(field.value)
    })),
    ...bodyTranslationItems(pending.ref.id, bodySegments)
  ]

  const translations = await translateItems(
    pending.locale,
    items,
    translateBatch,
    config
  )

  const translatedFields = new Map(
    pending.fields.map((field) => [
      field.path,
      translations.get(field.path) ?? field.value
    ])
  )
  const translatedBody = assembleBody(bodySegments, translations)

  const syntaxErrors = findMdxSyntaxErrors(translatedBody)
  if (syntaxErrors.length > 0) {
    return { outcome: 'rejected', reason: syntaxErrors.join('; ') }
  }

  const reviewItem: ReviewItem = {
    id: pending.ref.id,
    context: pending.ref.id,
    source: translatableSignature(pending.fields, pending.body),
    translation: translatableSignature(
      pending.fields.map((field) => ({
        path: field.path,
        value: translatedFields.get(field.path) ?? field.value
      })),
      translatedBody
    )
  }
  const verdicts = await reviewItems(
    pending.locale,
    [reviewItem],
    reviewBatch,
    config
  )
  const verdict = verdicts.get(pending.ref.id)
  if (!verdict?.pass) {
    return { outcome: 'rejected', reason: verdict?.reason ?? 'no verdict' }
  }

  return {
    outcome: 'written',
    frontmatter: applyFrontmatterTranslations(
      pending.ref,
      pending.frontmatter,
      translatedFields
    ),
    body: translatedBody
  }
}

async function run(argv: readonly string[]): Promise<void> {
  const check = argv.includes('--check')
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const contentDir = resolve(scriptDir, '../../src/content')
  const manifestPath = resolve(contentDir, '.i18n-manifest.json')
  const config = translationPipelineConfig

  const refs = discoverDocuments(contentDir)
  const manifest = loadManifest(manifestPath)
  const { pending, manifestUpdates } = collectPending(
    refs,
    manifest,
    config.outputLocales
  )

  if (check) {
    for (const item of pending) {
      print(`${item.locale.code}/${item.ref.id}: missing or stale`)
    }
    print(
      pending.length === 0
        ? 'All website content translations are up to date.'
        : `Pending: ${pending.length} documents.`
    )
    if (pending.length > 0) process.exitCode = 1
    return
  }

  if (pending.length === 0) {
    persistManifest(manifestPath, manifest, manifestUpdates)
    print('All website content translations are up to date.')
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      `${pending.length} documents need translation but OPENAI_API_KEY is not set.`
    )
  }

  const counter = createRequestCounter()
  const translateBatch = createOpenAiTranslator({
    apiKey,
    fetchFn: counter.fetch,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    glossary: config.glossary,
    maxTruncationSplitDepth: config.maxTruncationSplitDepth
  })
  const reviewBatch = createOpenAiReviewer({
    apiKey,
    fetchFn: counter.fetch,
    model: config.model,
    reasoningEffort: config.reasoningEffort
  })

  let written = 0
  let rejected = 0

  try {
    for (const item of pending) {
      const result = await translateDocument(
        item,
        translateBatch,
        reviewBatch,
        config
      )
      if (result.outcome === 'rejected') {
        rejected++
        print(`REJECTED ${item.locale.code}/${item.ref.id}: ${result.reason}`)
        continue
      }
      const outPath = item.ref.localePath(item.locale.code)
      mkdirSync(dirname(outPath), { recursive: true })
      // Write beside the destination and rename into place, so a run that
      // fails mid-write never leaves a partial file at outPath for the next
      // run to bootstrap a baseline hash against.
      const tmpPath = `${outPath}.tmp-${process.pid}`
      writeFileSync(tmpPath, serializeDocument(result.frontmatter, result.body))
      renameSync(tmpPath, outPath)
      const localeHashes = manifestUpdates.get(item.ref.id) ?? new Map()
      localeHashes.set(item.locale.code, item.sourceHash)
      manifestUpdates.set(item.ref.id, localeHashes)
      written++
    }
  } finally {
    // Persist whatever completed even when a document further down the list
    // throws, so a hard failure loses no more progress than it has to and
    // the next run picks up exactly where this one stopped.
    persistManifest(manifestPath, manifest, manifestUpdates)
  }

  if (counter.requestCount() > 0) {
    print(`OpenAI usage: ${counter.requestCount()} HTTP requests.`)
  }
  print(
    `Translated ${written} documents; ${rejected} held back by AI review (will retry next run).`
  )
}

const invokedAsScript = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false
if (invokedAsScript) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
