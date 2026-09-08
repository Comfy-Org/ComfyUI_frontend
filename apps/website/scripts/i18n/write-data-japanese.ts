/**
 * write-data-japanese — mirrors the machine's Japanese into `src/data/*.ts`.
 *
 * Run: `pnpm i18n:write-data [--dry-run]` (no API key needed).
 *
 * Every other locale layer is read at render time from JSON. Data files cannot
 * be: pages index them directly (`event.title[locale] || event.title.en`, 98
 * times across 29 files), so there is no key at the call site to look anything
 * up with. The translation therefore has to live in the file, and this is the
 * only thing that puts it there.
 *
 * Source of truth is `content/ja.json`, the enforced machine layer — never
 * `resolved/`, which falls back to English and would write English sentences
 * into a Japanese field.
 *
 * All-or-nothing. Every file is planned and verified before any is written, so
 * a single failure leaves all 18 untouched rather than half a run on disk.
 *
 * The decisions live in `src/i18n/pipeline/adapters/data.ts` as pure, tested
 * functions; this file only does IO, like the rest of the pipeline.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  applyEdits,
  dataAdapter,
  planJapanese,
  verifyWrite
} from '../../src/i18n/pipeline/adapters/data'
import type { TranslationLayer } from '../../src/i18n/pipeline/types'

const DATA_DIR = path.join(process.cwd(), 'src', 'data')
const MACHINE_FILE = path.join(
  process.cwd(),
  'src',
  'i18n',
  'content',
  'ja.json'
)

/**
 * An absent file is fine — nothing has been translated yet. A file that exists
 * but does not parse is not: writing from a half-read layer would put the wrong
 * Japanese into hand-written source.
 */
function readMachineLayer(): TranslationLayer {
  let text: string
  try {
    text = fs.readFileSync(MACHINE_FILE, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  return JSON.parse(text) as TranslationLayer
}

interface Planned {
  file: string
  original: string
  written: string
  inserted: number
  replaced: number
  problems: string[]
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run')

  const machine = readMachineLayer()
  const ownedKeys = new Set(dataAdapter.read().map((entry) => entry.key))

  const japanese: Record<string, string> = {}
  for (const [key, value] of Object.entries(machine)) {
    if (ownedKeys.has(key)) japanese[key] = value
  }

  if (Object.keys(japanese).length === 0) {
    process.stdout.write(
      '[i18n] no Japanese for any data key yet — run `pnpm i18n:translate` first.\n'
    )
    return
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .sort()

  const planned: Planned[] = []
  for (const file of files) {
    const original = fs.readFileSync(path.join(DATA_DIR, file), 'utf8')
    const edits = planJapanese(file, original, japanese)
    if (edits.length === 0) continue

    const written = applyEdits(original, edits)
    planned.push({
      file,
      original,
      written,
      inserted: edits.filter((edit) => edit.length === 0).length,
      replaced: edits.filter((edit) => edit.length > 0).length,
      problems: verifyWrite(file, original, written, edits)
    })
  }

  const broken = planned.filter((entry) => entry.problems.length > 0)
  if (broken.length > 0) {
    for (const entry of broken) {
      process.stderr.write(`[i18n] ${entry.file}\n`)
      for (const problem of entry.problems) {
        process.stderr.write(`         ${problem}\n`)
      }
    }
    process.stderr.write(
      `[i18n] ${broken.length} file(s) failed verification. Nothing written.\n`
    )
    process.exit(1)
  }

  const inserted = planned.reduce((n, entry) => n + entry.inserted, 0)
  const replaced = planned.reduce((n, entry) => n + entry.replaced, 0)

  if (dryRun) {
    for (const entry of planned) {
      process.stdout.write(
        `[i18n] ${entry.file}: +${entry.inserted} new, ~${entry.replaced} refreshed\n`
      )
    }
    process.stdout.write(
      `[i18n] dry run: ${inserted} to add, ${replaced} to refresh, across ${planned.length} file(s). Nothing written.\n`
    )
    return
  }

  for (const entry of planned) {
    fs.writeFileSync(path.join(DATA_DIR, entry.file), entry.written, 'utf8')
  }

  process.stdout.write(
    `[i18n] ${inserted} added, ${replaced} refreshed, across ${planned.length} file(s).\n`
  )
  process.stdout.write('[i18n] run `pnpm format` — some lines will reflow.\n')
}

main()
