import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { OutputLocale } from './config'
import { translationPipelineConfig } from './config'
import { hashSource, loadManifest, saveManifest } from './manifest'
import type { TranslationManifest } from './manifest'
import { createOpenAiReviewer, reviewItems } from './review'
import type { ReviewItem } from './review'
import {
  createOpenAiTranslator,
  createRequestCounter,
  translateItems
} from './translate'
import type { TranslationItem } from './translate'
import {
  applyFrontmatterTranslations,
  discoverDocuments,
  readDocument,
  serializeDocument,
  translatableFields
} from './document'
import type { DocumentRef, TranslatableField } from './document'
import { protectedTokens } from './protected-tokens'

interface PendingDocument {
  ref: DocumentRef
  locale: OutputLocale
  fields: TranslatableField[]
  body: string
  sourceHash: string
}

function documentSourceSignature(
  fields: TranslatableField[],
  body: string
): string {
  return `${fields.map((field) => field.value).join('\n')}\n${body}`
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
    const sourceHash = hashSource(documentSourceSignature(fields, body))

    for (const locale of outputLocales) {
      const recordedHash = manifest.entries[ref.id]?.[locale.code]

      if (!existsSync(ref.localePath(locale.code))) {
        pending.push({ ref, locale, fields, body, sourceHash })
        continue
      }
      if (recordedHash === undefined) {
        const localeHashes = manifestUpdates.get(ref.id) ?? new Map()
        localeHashes.set(locale.code, sourceHash)
        manifestUpdates.set(ref.id, localeHashes)
        continue
      }
      if (recordedHash !== sourceHash) {
        pending.push({ ref, locale, fields, body, sourceHash })
      }
    }
  }

  return { pending, manifestUpdates }
}

async function translateDocument(
  pending: PendingDocument,
  translateBatch: Parameters<typeof translateItems>[2],
  reviewBatch: Parameters<typeof reviewItems>[2],
  config: typeof translationPipelineConfig
): Promise<
  | { outcome: 'written'; frontmatter: unknown; body: string }
  | { outcome: 'rejected'; reason: string }
> {
  const items: TranslationItem[] = [
    ...pending.fields.map((field) => ({
      id: field.path,
      context: `${pending.ref.id}: ${field.path}`,
      source: field.value,
      preserve: protectedTokens(field.value)
    })),
    {
      id: 'body',
      context: `${pending.ref.id}: body`,
      source: pending.body,
      preserve: protectedTokens(pending.body)
    }
  ]

  let translations: Map<string, string>
  try {
    translations = await translateItems(
      pending.locale,
      items,
      translateBatch,
      config
    )
  } catch (error) {
    return {
      outcome: 'rejected',
      reason: error instanceof Error ? error.message : String(error)
    }
  }

  const translatedFields = new Map(
    pending.fields.map((field) => [
      field.path,
      translations.get(field.path) ?? field.value
    ])
  )
  const translatedBody = translations.get('body') ?? pending.body

  const reviewItem: ReviewItem = {
    id: pending.ref.id,
    context: pending.ref.id,
    source: documentSourceSignature(pending.fields, pending.body),
    translation: documentSourceSignature(
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

  const { frontmatter } = readDocument(pending.ref, pending.ref.enPath)
  return {
    outcome: 'written',
    frontmatter: applyFrontmatterTranslations(
      pending.ref,
      frontmatter,
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
    return
  }

  if (pending.length === 0) {
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
    writeFileSync(outPath, serializeDocument(result.frontmatter, result.body))
    const localeHashes = manifestUpdates.get(item.ref.id) ?? new Map()
    localeHashes.set(item.locale.code, item.sourceHash)
    manifestUpdates.set(item.ref.id, localeHashes)
    written++
  }

  const nextEntries: TranslationManifest['entries'] = { ...manifest.entries }
  for (const [id, locales] of manifestUpdates) {
    nextEntries[id] = { ...nextEntries[id], ...Object.fromEntries(locales) }
  }
  saveManifest(manifestPath, { version: 1, entries: nextEntries })

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
