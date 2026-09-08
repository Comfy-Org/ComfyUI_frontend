/**
 * write-faq-japanese — writes the machine's Japanese FAQ answers as `.mdx`.
 *
 * Run: `pnpm i18n:write-faq [--dry-run]` (no API key needed).
 *
 * `PricingFaq.astro` already selects entries by a `<category>/<locale>/` id
 * prefix, so a Japanese answer is simply a new file in a new folder. No page or
 * component changes, and nothing existing is edited — unlike the data files,
 * every write here creates or replaces a file the pipeline itself owns.
 *
 * A Japanese file without a `translatedBy: machine` marker was written by a
 * person and is never touched.
 *
 * All-or-nothing: every answer is built and verified before any is written.
 *
 * The decisions live in `src/i18n/pipeline/adapters/faq.ts` as pure, tested
 * functions; this file only does IO.
 */
import fs from 'node:fs'
import path from 'node:path'

import { DEFAULT_LOCALE } from '../../src/config/locales'
import {
  buildFaqDocument,
  readFaqDocuments,
  verifyFaqDocument
} from '../../src/i18n/pipeline/adapters/faq'
import type { FaqDocument } from '../../src/i18n/pipeline/adapters/faq'
import type { TranslationLayer } from '../../src/i18n/pipeline/types'

const TARGET = 'ja'
const FAQ_DIR = path.join(process.cwd(), 'src', 'content', 'faq')
const MACHINE_FILE = path.join(
  process.cwd(),
  'src',
  'i18n',
  'content',
  `${TARGET}.json`
)

/**
 * An absent file is fine — nothing has been translated yet. A file that exists
 * but does not parse is not: writing from a half-read layer would publish the
 * wrong answers.
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
  slug: string
  file: string
  contents: string
  problems: string[]
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run')
  // A lookup can miss, and the type has to say so or the guards below read as
  // dead code to a type-aware linter.
  const machine: Readonly<Partial<Record<string, string>>> = readMachineLayer()
  const documents = readFaqDocuments()

  const existing = new Map<string, FaqDocument>()
  for (const document of documents) {
    if (document.locale === TARGET) {
      existing.set(`${document.category}/${document.slug}`, document)
    }
  }

  const planned: Planned[] = []
  const skipped: string[] = []

  for (const english of documents) {
    if (english.locale !== DEFAULT_LOCALE) continue

    const id = `${english.category}/${english.slug}`
    const key = `faq.${english.category}.${english.slug}`
    const question = machine[`${key}.question`]
    const body = machine[`${key}.body`]
    if (question === undefined || body === undefined) continue

    // A person's translation is never overwritten.
    const already = existing.get(id)
    if (already && !already.machineWritten) {
      skipped.push(id)
      continue
    }

    const contents = buildFaqDocument(english, { question, body })
    planned.push({
      slug: id,
      file: path.join(FAQ_DIR, english.category, TARGET, `${english.slug}.mdx`),
      contents,
      problems: verifyFaqDocument(english, contents)
    })
  }

  if (planned.length === 0) {
    process.stdout.write(
      '[i18n] no Japanese for any FAQ answer yet — run `pnpm i18n:translate` first.\n'
    )
    return
  }

  const broken = planned.filter((entry) => entry.problems.length > 0)
  if (broken.length > 0) {
    for (const entry of broken) {
      process.stderr.write(`[i18n] ${entry.slug}\n`)
      for (const problem of entry.problems) {
        process.stderr.write(`         ${problem}\n`)
      }
    }
    process.stderr.write(
      `[i18n] ${broken.length} answer(s) failed verification. Nothing written.\n`
    )
    process.exit(1)
  }

  for (const id of skipped) {
    process.stdout.write(`[i18n] ${id}: left alone, a person wrote it\n`)
  }

  if (dryRun) {
    process.stdout.write(
      `[i18n] dry run: ${planned.length} answer(s) to write. Nothing written.\n`
    )
    return
  }

  for (const entry of planned) {
    fs.mkdirSync(path.dirname(entry.file), { recursive: true })
    fs.writeFileSync(entry.file, entry.contents, 'utf8')
  }

  process.stdout.write(
    `[i18n] wrote ${planned.length} Japanese FAQ answer(s).\n`
  )
}

main()
