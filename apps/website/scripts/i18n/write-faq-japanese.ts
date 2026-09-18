/**
 * write-faq-japanese — writes the machine's Japanese FAQ answers as `.mdx`.
 *
 * Run: `pnpm i18n:write-faq [--dry-run | --check]` (no API key needed).
 *
 * `--check` writes nothing and exits non-zero when what is on disk is behind
 * the machine layer. CI runs it on pull requests, so a translation that was
 * withdrawn or refreshed cannot merge with its old `.mdx` still published.
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
import { assertValidPlan } from './assert-valid-plan'
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
import {
  alreadyOnDisk,
  exitCheck,
  writeMode,
  writtenByPerson
} from './write-mode'

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

interface FaqWritePlan {
  planned: Planned[]
  skipped: string[]
  withdrawn: { slug: string; file: string }[]
}

function faqTranslation(
  question: string | undefined,
  body: string | undefined
) {
  return question === undefined || body === undefined
    ? undefined
    : { question, body }
}

function withdrawFaq(
  english: FaqDocument,
  already: FaqDocument | undefined,
  id: string,
  withdrawn: FaqWritePlan['withdrawn']
): void {
  if (already)
    withdrawn.push({
      slug: id,
      file: path.join(FAQ_DIR, english.category, TARGET, `${english.slug}.mdx`)
    })
}

function planFaq(
  english: FaqDocument,
  existing: Map<string, FaqDocument>,
  machine: Readonly<Partial<TranslationLayer>>,
  plan: FaqWritePlan
): void {
  const { planned, skipped, withdrawn } = plan
  const id = `${english.category}/${english.slug}`
  const key = `faq.${english.category}.${english.slug}`
  const question = machine[`${key}.question`]
  const body = machine[`${key}.body`]

  // A person's translation is never overwritten, and never withdrawn.
  const already = existing.get(id)
  if (writtenByPerson(already)) {
    skipped.push(id)
    return
  }

  // Withdrawn: `enforce` dropped this answer, so the machine-written file on
  // disk is no longer justified. Skipping it left the rejected Japanese
  // published — `/ja/pricing` went on selecting the `.mdx` this pipeline had
  // written, which made enforcement cosmetic for anything already generated.
  const translation = faqTranslation(question, body)
  if (!translation) {
    withdrawFaq(english, already, id, withdrawn)
    return
  }

  const contents = buildFaqDocument(english, translation)
  const file = path.join(
    FAQ_DIR,
    english.category,
    TARGET,
    `${english.slug}.mdx`
  )
  if (alreadyOnDisk(file, contents)) return
  planned.push({
    slug: id,
    file,
    contents,
    problems: verifyFaqDocument(english, contents)
  })
}

function planFaqWrites(
  machine: Readonly<Partial<TranslationLayer>>
): FaqWritePlan {
  const documents = readFaqDocuments()

  const existing = new Map<string, FaqDocument>()
  for (const document of documents) {
    if (document.locale === TARGET) {
      existing.set(`${document.category}/${document.slug}`, document)
    }
  }

  const planned: Planned[] = []
  const skipped: string[] = []
  const withdrawn: { slug: string; file: string }[] = []

  for (const english of documents.filter(
    (document) => document.locale === DEFAULT_LOCALE
  )) {
    planFaq(english, existing, machine, { planned, skipped, withdrawn })
  }

  return { planned, skipped, withdrawn }
}

function reportFaqPlan({ skipped, withdrawn }: FaqWritePlan): void {
  for (const id of skipped) {
    process.stdout.write(`[i18n] ${id}: left alone, a person wrote it\n`)
  }

  for (const entry of withdrawn) {
    process.stdout.write(
      `[i18n] ${entry.slug}: withdrawn, its translation was rejected\n`
    )
  }
}

function commitPlannedDocuments(
  planned: Planned[],
  withdrawn: { file: string }[]
): void {
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

  // Removed after the writes, so a failure mid-write rolls back with every file
  // still on disk rather than half of them already deleted.
  for (const entry of withdrawn) fs.rmSync(entry.file, { force: true })
}

function reportWritten(planned: Planned[], withdrawn: unknown[]): void {
  process.stdout.write(
    `[i18n] wrote ${planned.length} Japanese FAQ answer(s)` +
      (withdrawn.length > 0 ? `, withdrew ${withdrawn.length}` : '') +
      `.\n`
  )
}

function main(): void {
  const mode = writeMode()
  // A lookup can miss, and the type has to say so or the guards below read as
  // dead code to a type-aware linter.
  const machine: Readonly<Partial<Record<string, string>>> = readMachineLayer()
  const { planned, skipped, withdrawn } = planFaqWrites(machine)
  const changes = planned.length + withdrawn.length

  if (mode === 'check') {
    reportFaqPlan({ planned, skipped, withdrawn })
    exitCheck(
      changes === 0,
      'the Japanese FAQ',
      `${planned.length} answer(s) to write and ${withdrawn.length} to withdraw`,
      'pnpm i18n:write-faq'
    )
    return
  }

  if (changes === 0) {
    process.stdout.write(
      '[i18n] Japanese FAQ answers are current with the machine layer.\n'
    )
    return
  }

  assertValidPlan(
    planned.map((entry) => ({ label: entry.slug, problems: entry.problems })),
    'answer(s)'
  )

  reportFaqPlan({ planned, skipped, withdrawn })

  if (mode === 'dry-run') {
    process.stdout.write(
      `[i18n] dry run: ${planned.length} answer(s) to write, ` +
        `${withdrawn.length} to withdraw. Nothing written.\n`
    )
    return
  }

  commitPlannedDocuments(planned, withdrawn)
  reportWritten(planned, withdrawn)
}

main()
