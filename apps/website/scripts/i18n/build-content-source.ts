/**
 * build-content-source — produces the English content-of-record, the hash
 * manifest, and the per-locale work list for the marketing translation pipeline.
 *
 * Run: `pnpm i18n:build-source` (no API key needed).
 *
 * Outputs, under `src/i18n/`:
 *   content/en.json        the English content-of-record
 *   content/{locale}.json  the model's output, pruned here but never written to
 *                          by this script beyond pruning
 *   pending/{locale}.json  what the model is asked to translate on the next run
 *   manifest.json          per-key hash of the English, to detect what moved
 *
 * There is no `human/` directory, unlike the hub. Marketing's approved
 * translations already live in `translations.ts`, so that file IS the human
 * layer and is never written to by any part of this pipeline. Provenance is
 * still explicit: approved comes from TypeScript, machine from JSON.
 *
 * All decisions live in `src/i18n/pipeline/source.ts` as pure, unit-tested
 * functions. This file only does IO, mirroring how the hub splits the two.
 */
import fs from 'node:fs'
import path from 'node:path'

import { LOCALIZED_CODES } from '../../src/config/locales'
import { translationsAdapter } from '../../src/i18n/pipeline/adapters/translations'
import {
  buildEnglishSource,
  buildManifest,
  pendingSource,
  pruneOrphanKeys,
  pruneStaleKeys,
  staleKeys
} from '../../src/i18n/pipeline/source'
import type {
  Manifest,
  SourceAdapter,
  TranslationLayer
} from '../../src/i18n/pipeline/types'

/**
 * Sources, in the order their keys are collected. `translations.ts` is the only
 * one at launch; `src/data/*.ts` and the MDX collections join here later without
 * anything else in this file changing.
 */
const ADAPTERS: SourceAdapter[] = [translationsAdapter]

const I18N_DIR = path.join(process.cwd(), 'src', 'i18n')
const CONTENT_DIR = path.join(I18N_DIR, 'content')
const PENDING_DIR = path.join(I18N_DIR, 'pending')
const MANIFEST_FILE = path.join(I18N_DIR, 'manifest.json')

/** Keys are written in sorted order so a diff shows content changes, not churn. */
function writeJson(file: string, value: Record<string, string>): void {
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = value[key]
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

function readJson<T extends Record<string, string>>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return {} as T
  }
}

function main(): void {
  const entries = ADAPTERS.flatMap((adapter) => adapter.read())

  const duplicates = entries
    .map((entry) => entry.key)
    .filter((key, index, all) => all.indexOf(key) !== index)
  if (duplicates.length > 0) {
    // Two adapters claiming one key would make provenance ambiguous and let one
    // source silently shadow the other.
    throw new Error(
      `[i18n] duplicate keys across sources: ${[...new Set(duplicates)].join(', ')}`
    )
  }

  const english = buildEnglishSource(entries)
  const nextManifest = buildManifest(entries)
  const previousManifest = readJson<Manifest>(MANIFEST_FILE)
  const stale = staleKeys(previousManifest, nextManifest)

  writeJson(path.join(CONTENT_DIR, 'en.json'), english)

  const currentKeys = new Set(Object.keys(english))
  const summary: string[] = []

  for (const locale of LOCALIZED_CODES) {
    const machineFile = path.join(CONTENT_DIR, `${locale}.json`)
    const before = readJson<TranslationLayer>(machineFile)
    const machine = pruneStaleKeys(pruneOrphanKeys(before, currentKeys), stale)
    writeJson(machineFile, machine)

    const pending = pendingSource(entries, locale, machine)
    writeJson(path.join(PENDING_DIR, `${locale}.json`), pending)

    const dropped = Object.keys(before).length - Object.keys(machine).length
    summary.push(
      `  ${locale}: ${Object.keys(machine).length} translated, ` +
        `${Object.keys(pending).length} pending` +
        (dropped > 0 ? `, ${dropped} dropped as stale or orphaned` : '')
    )
  }

  writeJson(MANIFEST_FILE, nextManifest)

  // process.stdout rather than console.log, matching generate-models.ts and the
  // repo's no-console lint rule, which permits only warn and error.
  process.stdout.write(
    `[i18n] ${entries.length} keys from ${ADAPTERS.length} source(s); ` +
      `${Object.keys(english).length} translatable` +
      (stale.length > 0 ? `; ${stale.length} changed since last run` : '') +
      '\n'
  )
  for (const line of summary) process.stdout.write(`${line}\n`)
}

main()
