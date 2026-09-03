import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { OutputLocale } from './config'
import { translationPipelineConfig } from './config'
import type { TranslationManifest } from './manifest'
import { hashSource, loadManifest, saveManifest } from './manifest'
import { protectedTokens, tokenErrors } from './protected-tokens'
import type { ReviewItem } from './review'
import { createOpenAiReviewer, reviewItems } from './review'
import type { TextEdit, TranslationEntry } from './source'
import {
  applyEdits,
  insertLocaleEdit,
  parseTranslations,
  replaceLocaleEdit
} from './source'
import type { TranslationItem } from './translate'
import {
  createOpenAiTranslator,
  createRequestCounter,
  translateItems
} from './translate'

interface PendingItem {
  entry: TranslationEntry
  locale: OutputLocale
  source: string
  hasExisting: boolean
}

function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

export function collectPending(
  entries: readonly TranslationEntry[],
  manifest: TranslationManifest,
  outputLocales: readonly OutputLocale[]
): {
  pending: PendingItem[]
  manifestUpdates: Map<string, Map<string, string>>
} {
  const pending: PendingItem[] = []
  const manifestUpdates = new Map<string, Map<string, string>>()

  for (const entry of entries) {
    const enValue = entry.values.en
    if (enValue === undefined) continue
    const enHash = hashSource(enValue)

    for (const locale of outputLocales) {
      const existingValue = entry.values[locale.code]
      const recordedHash = manifest.entries[entry.key]?.[locale.code]

      if (existingValue === undefined) {
        pending.push({ entry, locale, source: enValue, hasExisting: false })
        continue
      }
      if (recordedHash === undefined) {
        // A translation exists but the pipeline has no record of it (first
        // run, or it was added by hand): trust it as the new baseline rather
        // than spending a translation call to reproduce what is already there.
        const localeHashes = manifestUpdates.get(entry.key) ?? new Map()
        localeHashes.set(locale.code, enHash)
        manifestUpdates.set(entry.key, localeHashes)
        continue
      }
      if (recordedHash !== enHash) {
        pending.push({ entry, locale, source: enValue, hasExisting: true })
      }
    }
  }

  return { pending, manifestUpdates }
}

export function auditExisting(entries: readonly TranslationEntry[]): string[] {
  const errors: string[] = []
  for (const entry of entries) {
    const enValue = entry.values.en
    if (enValue === undefined) continue
    for (const [locale, value] of Object.entries(entry.values)) {
      if (locale === 'en') continue
      for (const error of tokenErrors(enValue, value)) {
        errors.push(`${locale}/${entry.key}: ${error}`)
      }
    }
  }
  return errors
}

async function run(argv: readonly string[]): Promise<void> {
  const check = argv.includes('--check')
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const sourcePath = resolve(scriptDir, '../../src/i18n/translations.ts')
  const manifestPath = resolve(
    scriptDir,
    '../../src/i18n/.translations-manifest.json'
  )
  const config = translationPipelineConfig

  const { text, entries } = parseTranslations(sourcePath)
  const manifest = loadManifest(manifestPath)
  const { pending, manifestUpdates } = collectPending(
    entries,
    manifest,
    config.outputLocales
  )
  const auditErrors = auditExisting(entries)

  if (check) {
    for (const item of pending) {
      print(
        `${item.locale.code}/${item.entry.key}: ${item.hasExisting ? 'stale (English source changed)' : 'missing'}`
      )
    }
    // Informational only: existing copy legitimately diverges from a naive
    // token match (zh-CN re-targets hrefs at zh-CN-prefixed pages, restructures
    // sentences around a placeholder for word order), so this never fails the
    // check — a human can scan it, but it does not block CI.
    for (const error of auditErrors) print(`NOTE ${error}`)
    if (pending.length === 0 && auditErrors.length === 0) {
      print('All website translations.ts locales are up to date.')
    } else {
      print(
        `Pending: ${pending.length} translations, ${auditErrors.length} existing-copy notes.`
      )
    }
    return
  }

  for (const error of auditErrors) print(`WARNING: ${error}`)

  if (pending.length === 0) {
    print('All website translations.ts locales are up to date.')
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      `${pending.length} strings need translation but OPENAI_API_KEY is not set.`
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

  const edits: TextEdit[] = []
  let generated = 0
  let rejected = 0

  for (const locale of config.outputLocales) {
    const localePending = pending.filter(
      (item) => item.locale.code === locale.code
    )
    if (localePending.length === 0) continue

    const items: TranslationItem[] = localePending.map((item, index) => ({
      id: String(index + 1),
      context: item.entry.key,
      source: item.source,
      preserve: protectedTokens(item.source)
    }))
    const translations = await translateItems(
      locale,
      items,
      translateBatch,
      config
    )

    const reviewCandidates: ReviewItem[] = []
    for (const [index, item] of localePending.entries()) {
      const translation = translations.get(String(index + 1))
      if (translation === undefined) continue
      reviewCandidates.push({
        id: String(index + 1),
        context: item.entry.key,
        source: item.source,
        translation
      })
    }
    const verdicts = await reviewItems(
      locale,
      reviewCandidates,
      reviewBatch,
      config
    )

    for (const [index, item] of localePending.entries()) {
      const id = String(index + 1)
      const translation = translations.get(id)
      const verdict = verdicts.get(id)
      if (translation === undefined) continue
      if (!verdict?.pass) {
        rejected++
        print(
          `REJECTED ${locale.code}/${item.entry.key}: ${verdict?.reason ?? 'no verdict'}`
        )
        continue
      }
      edits.push(
        item.hasExisting
          ? replaceLocaleEdit(item.entry, locale.code, translation)
          : insertLocaleEdit(item.entry, locale.code, translation)
      )
      const localeHashes = manifestUpdates.get(item.entry.key) ?? new Map()
      localeHashes.set(locale.code, hashSource(item.source))
      manifestUpdates.set(item.entry.key, localeHashes)
      generated++
    }
  }

  if (counter.requestCount() > 0) {
    print(`OpenAI usage: ${counter.requestCount()} HTTP requests.`)
  }

  if (edits.length > 0) {
    writeFileSync(sourcePath, applyEdits(text, edits))
  }

  const nextEntries: TranslationManifest['entries'] = { ...manifest.entries }
  for (const [key, locales] of manifestUpdates) {
    nextEntries[key] = { ...nextEntries[key], ...Object.fromEntries(locales) }
  }
  saveManifest(manifestPath, { version: 1, entries: nextEntries })

  print(
    `Translated ${generated} strings; ${rejected} held back by AI review (will retry next run).`
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
