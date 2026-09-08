/**
 * The FAQ MDX source adapter.
 *
 * 26 English answers — 21 on `/pricing`, 5 on `/enterprise` — each a small file
 * of `question` frontmatter and a markdown body. Chinese is complete; Japanese
 * does not exist, which is why `/pricing` was held out of the Japanese tier.
 *
 * Unlike `src/data/*.ts`, nothing here needs writing back into a hand-written
 * file. `PricingFaq.astro` already selects entries by a `<category>/<locale>/`
 * id prefix, so a Japanese answer is a new file in a new folder and no page or
 * component changes at all.
 *
 * The frontmatter is kept raw rather than parsed into fields and rebuilt.
 * `order` decides the sequence a reader sees, and copying the line verbatim
 * cannot renumber it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULT_LOCALE, isLocale } from '../../../config/locales'
import type { Locale } from '../../../config/locales'
import type { SourceAdapter, SourceEntry } from '../types'
import { linkTargets, localizeMarkdownLinks } from '../validate'

const FAQ_DIR = join(process.cwd(), 'src', 'content', 'faq')

/** The only locale this pipeline generates today. */
const TARGET_LOCALE = 'ja' as const

/** One answer, in one language. */
export interface FaqDocument {
  category: string
  locale: string
  slug: string
  question: string
  body: string
  /** The frontmatter block verbatim, so a writer can reuse `order`. */
  frontmatter: string
  /** Written by the pipeline rather than by a person. */
  machineWritten: boolean
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
const QUESTION = /^question:\s*"((?:[^"\\]|\\.)*)"\s*$/m
const MACHINE = /^translatedBy:\s*machine\s*$/m

/**
 * Split one `.mdx` file into the parts the pipeline cares about.
 *
 * Deliberately not a YAML parser. The schema is two fields wide and every one
 * of the 52 files writes `question` as a double-quoted scalar, so a targeted
 * read is both sufficient and easier to reason about than a dependency that
 * could reformat `order` on the way back out.
 */
export function parseFaqDocument(id: string, text: string): FaqDocument {
  const parts = FRONTMATTER.exec(text)
  if (!parts) throw new Error(`${id}: no frontmatter block`)

  const [, frontmatter, body] = parts
  const question = QUESTION.exec(frontmatter)
  if (!question) throw new Error(`${id}: no double-quoted question`)

  const [category = '', locale = '', slug = ''] = id.split('/')

  return {
    category,
    locale,
    slug,
    question: question[1].replaceAll('\\"', '"'),
    body,
    frontmatter,
    machineWritten: MACHINE.test(frontmatter)
  }
}

/** `<category>/<slug>`, which is what pairs an answer with its translations. */
function answerId(document: FaqDocument): string {
  return `${document.category}/${document.slug}`
}

/**
 * Two entries per English answer — the question and the body — with every
 * other locale's file supplying the approved translation.
 *
 * A translation the pipeline wrote is not approved. Approved values are never
 * re-sent to the model, so counting its own output would freeze the answer the
 * first time its English changed.
 */
export function entriesFromFaq(
  documents: readonly FaqDocument[]
): SourceEntry[] {
  const byAnswer = new Map<string, Map<string, FaqDocument>>()
  for (const document of documents) {
    const locales = byAnswer.get(answerId(document)) ?? new Map()
    locales.set(document.locale, document)
    byAnswer.set(answerId(document), locales)
  }

  const entries: SourceEntry[] = []
  for (const [id, locales] of byAnswer) {
    const english = locales.get(DEFAULT_LOCALE)
    // A translation with no English original has nothing to be a translation
    // of, and no source to re-translate from.
    if (!english) continue

    for (const field of ['question', 'body'] as const) {
      const approved: Partial<Record<Locale, string>> = {}
      for (const [locale, document] of locales) {
        if (locale === DEFAULT_LOCALE || !isLocale(locale)) continue
        if (document.machineWritten) continue
        approved[locale] = document[field].trim()
      }
      entries.push({
        key: `faq.${id.replace('/', '.')}.${field}`,
        english: english[field].trim(),
        approved
      })
    }
  }

  return entries
}

/** One answer's translated text. */
export interface FaqTranslation {
  question: string
  body: string
}

const ORDER = /^order:\s*\d+\s*$/m

/**
 * A complete `.mdx` file for a translated answer.
 *
 * `order` is copied from the English file rather than re-serialised from a
 * parsed number: it decides the sequence a reader sees, and a line carried
 * across verbatim cannot renumber itself.
 *
 * The `translatedBy: machine` marker goes in every generated file. Without it
 * the next run cannot tell its own output from a reviewed translation, and
 * would be free to overwrite the reviewed one.
 */
export function buildFaqDocument(
  english: FaqDocument,
  translation: FaqTranslation
): string {
  const order = ORDER.exec(english.frontmatter)
  if (!order) throw new Error(`${english.slug}: English file has no order`)

  const question = translation.question.replaceAll('"', '\\"')

  return [
    '---',
    `question: "${question}"`,
    order[0].trim(),
    'translatedBy: machine',
    '---',
    '',
    localizeMarkdownLinks(translation.body.trim(), TARGET_LOCALE),
    ''
  ].join('\n')
}

/**
 * Everything that must be true of a generated answer before it is written.
 *
 * Link targets are the reason this exists. `FaqLink` renders whatever href the
 * file contains, so a target the model rewrote — `/ja/contact` is the tempting
 * one — becomes a link to a page that locale does not publish, and nothing else
 * would notice. The English targets are already correct for Japanese, because
 * `localizeHref` leaves an unpublished route unprefixed.
 */
export function verifyFaqDocument(
  english: FaqDocument,
  built: string
): string[] {
  const problems: string[] = []
  const generated = parseFaqDocument(
    `${english.category}/ja/${english.slug}`,
    built
  )

  if (!generated.machineWritten) {
    problems.push(
      'no `translatedBy: machine` marker, so a later run would treat it as human'
    )
  }

  const englishOrder = ORDER.exec(english.frontmatter)?.[0].trim()
  const builtOrder = ORDER.exec(generated.frontmatter)?.[0].trim()
  if (englishOrder !== builtOrder) {
    problems.push(
      `order drifted: English has \`${englishOrder}\`, this has \`${builtOrder}\``
    )
  }

  // Each link must point where this locale serves: the English path for a
  // route it does not publish, the prefixed path for one it does.
  const expected = [
    ...linkTargets(localizeMarkdownLinks(english.body, TARGET_LOCALE))
  ].sort()
  const actual = [...linkTargets(generated.body)].sort()
  for (const target of expected) {
    if (!actual.includes(target)) problems.push(`link target lost: ${target}`)
  }
  for (const target of actual) {
    if (!expected.includes(target))
      problems.push(`link target invented: ${target}`)
  }

  if (generated.question.trim() === english.question.trim()) {
    problems.push('question is still the English one')
  }
  if (generated.body.trim() === english.body.trim()) {
    problems.push('body is still English')
  }

  return problems
}

/** Every `.mdx` under `src/content/faq`, as `<category>/<locale>/<slug>`. */
export function readFaqDocuments(): FaqDocument[] {
  const documents: FaqDocument[] = []
  for (const category of readdirSync(FAQ_DIR)) {
    const categoryDir = join(FAQ_DIR, category)
    if (!statSync(categoryDir).isDirectory()) continue

    for (const locale of readdirSync(categoryDir)) {
      const localeDir = join(categoryDir, locale)
      if (!statSync(localeDir).isDirectory()) continue

      for (const file of readdirSync(localeDir).sort()) {
        if (!file.endsWith('.mdx')) continue
        const slug = file.replace(/\.mdx$/, '')
        const id = `${category}/${locale}/${slug}`
        documents.push(
          parseFaqDocument(id, readFileSync(join(localeDir, file), 'utf8'))
        )
      }
    }
  }
  return documents
}

export const faqAdapter: SourceAdapter = {
  name: 'faq',

  read(): SourceEntry[] {
    return entriesFromFaq(readFaqDocuments())
  }
}
