/**
 * write-data-japanese — mirrors the machine's Japanese into `src/data/*.ts`.
 *
 * Run: `pnpm i18n:write-data [--dry-run | --check]` (no API key needed).
 *
 * `--check` writes nothing and exits non-zero when a data file is behind the
 * machine layer. CI runs it on pull requests: editing the English above a
 * machine-written `ja` prunes the key from `content/ja.json`, but the `ja` in
 * the file is what the page reads, so without this it kept serving the
 * translation of a sentence that no longer exists until the next nightly run.
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
 * a rejected plan leaves all 18 untouched; and if a write fails partway, the
 * files already written are restored from the originals the planner is holding.
 * What that does not survive is the process being killed mid-loop — a real
 * guarantee there needs an on-disk journal, which is more machinery than a
 * re-runnable script warrants.
 *
 * The decisions live in `src/i18n/pipeline/adapters/data.ts` as pure, tested
 * functions; this file only does IO, like the rest of the pipeline.
 */
import fs from 'node:fs'
import { assertValidPlan } from './assert-valid-plan'
import path from 'node:path'

import {
  applyEdits,
  dataAdapter,
  planJapanese,
  verifyWrite
} from '../../src/i18n/pipeline/adapters/data'
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import { commitAll } from '../../src/i18n/pipeline/commit'
import type { TranslationLayer } from '../../src/i18n/pipeline/types'
import { exitCheck, writeMode } from './write-mode'

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
 *
 * `readTranslationLayer` also rejects a value that is not a string, which the
 * `as TranslationLayer` assertion here used to wave through — and an assertion
 * is exactly what would let a non-string reach `buildStory` typed as `string`
 * and be written into a source file.
 */
function readMachineLayer(): TranslationLayer {
  return readTranslationLayer(MACHINE_FILE)
}

interface Planned {
  file: string
  original: string
  written: string
  inserted: number
  replaced: number
  withdrawn: number
  problems: string[]
}

function planDataWrites(japanese: Record<string, string>): Planned[] {
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
      replaced: edits.filter((edit) => edit.length > 0 && edit.text !== '')
        .length,
      withdrawn: edits.filter((edit) => edit.text === '').length,
      problems: verifyWrite(file, original, written, edits)
    })
  }

  return planned
}

interface Totals {
  inserted: number
  replaced: number
  withdrawn: number
}

function totals(planned: readonly Planned[]): Totals {
  return {
    inserted: planned.reduce((n, entry) => n + entry.inserted, 0),
    replaced: planned.reduce((n, entry) => n + entry.replaced, 0),
    withdrawn: planned.reduce((n, entry) => n + entry.withdrawn, 0)
  }
}

function describe({ inserted, replaced, withdrawn }: Totals): string {
  return `${inserted} to add, ${replaced} to refresh, ${withdrawn} to withdraw`
}

function reportDryRun(planned: readonly Planned[], sum: Totals): void {
  for (const entry of planned) {
    process.stdout.write(
      `[i18n] ${entry.file}: +${entry.inserted} new, ~${entry.replaced} refreshed, -${entry.withdrawn} withdrawn\n`
    )
  }
  process.stdout.write(
    `[i18n] dry run: ${describe(sum)}, across ${planned.length} file(s). Nothing written.\n`
  )
}

function main(): void {
  const mode = writeMode()

  const machine = readMachineLayer()
  const ownedKeys = new Set(dataAdapter.read().map((entry) => entry.key))

  const japanese = Object.fromEntries(
    Object.entries(machine).filter(([key]) => ownedKeys.has(key))
  )

  const planned = planDataWrites(japanese)

  assertValidPlan(
    planned.map((entry) => ({ label: entry.file, problems: entry.problems })),
    'file(s)'
  )

  const sum = totals(planned)

  if (mode === 'check') {
    exitCheck(
      planned.length === 0,
      'src/data',
      `${describe(sum)} across ${planned.length} file(s)`,
      'pnpm i18n:write-data'
    )
    return
  }

  if (mode === 'dry-run') {
    reportDryRun(planned, sum)
    return
  }

  commitAll(planned, {
    write: (file, contents) =>
      fs.writeFileSync(path.join(DATA_DIR, file), contents, 'utf8'),
    // Unreachable here — these files are edited in place, so every entry
    // carries an `original` and rollback rewrites rather than removes. Supplied
    // because a rollback that silently skipped a file would be worse than one
    // that never had to run.
    remove: (file) => fs.rmSync(path.join(DATA_DIR, file), { force: true })
  })

  process.stdout.write(
    `[i18n] ${sum.inserted} added, ${sum.replaced} refreshed, ${sum.withdrawn} withdrawn, across ${planned.length} file(s).\n`
  )
  process.stdout.write('[i18n] run `pnpm format` — some lines will reflow.\n')
}

main()
