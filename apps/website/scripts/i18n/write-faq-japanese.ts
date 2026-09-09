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
 * All-or-nothing: every answer is built and verified before any is written, and
 * a write that fails partway is rolled back — answers this run created are
 * removed, answers it changed are restored. What that does not survive is the
 * process being killed mid-loop; a guarantee there needs an on-disk journal,
 * which is more than a re-runnable script warrants.
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
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import { commitAll } from '../../src/i18n/pipeline/commit'
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
  // Also rejects a value that is not a string, which the `as TranslationLayer`
  // assertion here used to wave through into an `.mdx` file typed as `string`.
  return readTranslationLayer(MACHINE_FILE)
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

  // `original` absent means the file is new, so rolling back removes it rather
  // than leaving an empty `.mdx` the site would render as an answer with no text.
  commitAll(
    planned.map((entry) => ({
      file: entry.file,
      original: fs.existsSync(entry.file)
        ? fs.readFileSync(entry.file, 'utf8')
        : undefined,
      written: entry.contents
    })),
    {
      write: (file, contents) => {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, contents, 'utf8')
      },
      remove: (file) => fs.rmSync(file, { force: true })
    }
  )

  process.stdout.write(
    `[i18n] wrote ${planned.length} Japanese FAQ answer(s).\n`
  )
}

main()
