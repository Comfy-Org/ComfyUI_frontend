/**
 * The customer-story MDX source adapter.
 *
 * 11 stories, 13,512 words of body, and JSX throughout — `Section`, `Figure`,
 * `Quote`, `AtAGlance`, `AuthorBio`, `Contributors`, `Embed`, `Steps`,
 * `Download`. The largest single body is 2,117 words.
 *
 * `loadStories` already selects by a `<locale>/` id prefix, so a Japanese story
 * is a new file in a new folder and no page changes. That fallback is
 * all-or-nothing per locale: write some stories and the rest do not fall back
 * to English, they vanish from `/ja/customers` entirely.
 *
 * Which fields are translatable was settled by reading what a person changed
 * when they wrote the Chinese, rather than by guessing:
 *
 *   translated  title, category, description, every `sections[].label`
 *   left alone  cover, order, readMore (URLs and a sort key)
 *   never       `sections[].id`, which the body's `<Section id>` anchors to
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULT_LOCALE, isLocale } from '../../../config/locales'
import type { Locale } from '../../../config/locales'
import type { SourceAdapter, SourceEntry } from '../types'
import { localizeMarkdownLinks } from '../validate'

const CUSTOMERS_DIR = join(process.cwd(), 'src', 'content', 'customers')

/** The only locale this pipeline generates today. */
const TARGET_LOCALE = 'ja' as const

/** One story, in one language. */
export interface Story {
  locale: string
  slug: string
  title: string
  category: string
  description: string
  sections: { id: string; label: string }[]
  body: string
  /** The frontmatter block verbatim, so a writer can reuse what it must not change. */
  frontmatter: string
  machineWritten: boolean
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
const MACHINE = /^translatedBy:\s*machine\s*$/m

/** A top-level scalar, quoted or bare. */
function scalar(frontmatter: string, field: string): string {
  const quoted = new RegExp(`^${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*$`, 'm')
  const bare = new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm')
  const match = quoted.exec(frontmatter) ?? bare.exec(frontmatter)
  return match ? match[1].replaceAll('\\"', '"') : ''
}

/**
 * Split one story into the parts the pipeline cares about.
 *
 * Deliberately not a YAML parser. The schema is seven fields wide and the only
 * nested one is `sections`, a flat list of id/label pairs, so a targeted read
 * is easier to reason about than a dependency that could reorder or requote
 * fields on the way back out.
 */
export function parseStory(id: string, text: string): Story {
  const parts = FRONTMATTER.exec(text)
  if (!parts) throw new Error(`${id}: no frontmatter block`)

  const [, frontmatter, body] = parts
  const [locale = '', slug = ''] = id.split('/')

  const sections: { id: string; label: string }[] = []
  const pattern = /-\s*id:\s*(\S+)\s*\n\s*label:\s*(.+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(frontmatter)) !== null) {
    sections.push({
      id: match[1].trim(),
      label: match[2].trim().replace(/^"(.*)"$/, '$1')
    })
  }

  return {
    locale,
    slug,
    title: scalar(frontmatter, 'title'),
    category: scalar(frontmatter, 'category'),
    description: scalar(frontmatter, 'description'),
    sections,
    body,
    frontmatter,
    machineWritten: MACHINE.test(frontmatter)
  }
}

const SECTION_BLOCK = /<Section\b[^>]*>[\s\S]*?<\/Section>/g

/** One piece of a story body: a section, or the prose between two of them. */
export interface BodyPiece {
  kind: 'section' | 'between'
  /** Present on every section; the body anchors to it. */
  id?: string
  text: string
}

/**
 * Split a story body into sections and the prose between them.
 *
 * Lossless by construction — the pieces concatenate back to the original — so
 * a translated story can be reassembled without reformatting the file. Checked
 * against all eleven stories before this was built on.
 */
export function splitStoryBody(body: string): BodyPiece[] {
  const pieces: BodyPiece[] = []
  let taken = 0

  for (const match of body.matchAll(SECTION_BLOCK)) {
    const start = match.index
    if (start > taken) {
      pieces.push({ kind: 'between', text: body.slice(taken, start) })
    }
    pieces.push({
      kind: 'section',
      id: /<Section\b[^>]*\bid="([^"]+)"/.exec(match[0])?.[1],
      text: match[0]
    })
    taken = start + match[0].length
  }

  if (taken < body.length) {
    pieces.push({ kind: 'between', text: body.slice(taken) })
  }
  return pieces
}

/** The between-pieces that hold prose rather than blank lines. */
export function proseBetween(pieces: readonly BodyPiece[]): BodyPiece[] {
  return pieces.filter(
    (piece) => piece.kind === 'between' && piece.text.trim() !== ''
  )
}

/**
 * Every translatable string in the English stories, with each other locale's
 * file supplying the approved translation.
 *
 * A section label is keyed by its section id rather than its position. Order
 * can change; the id cannot, because the body anchors to it — so an index would
 * renumber every label the first time a section moved, and the manifest would
 * pay to translate them all again.
 */
export function entriesFromStories(stories: readonly Story[]): SourceEntry[] {
  const bySlug = new Map<string, Map<string, Story>>()
  for (const story of stories) {
    const locales = bySlug.get(story.slug) ?? new Map()
    locales.set(story.locale, story)
    bySlug.set(story.slug, locales)
  }

  const entries: SourceEntry[] = []

  for (const [slug, locales] of bySlug) {
    const english = locales.get(DEFAULT_LOCALE)
    if (!english) continue

    const translations = [...locales].filter(
      ([locale, story]) =>
        locale !== DEFAULT_LOCALE && isLocale(locale) && !story.machineWritten
    )

    const add = (
      key: string,
      value: string,
      pick: (story: Story) => string | undefined
    ) => {
      if (value.trim() === '') return
      const approved: Partial<Record<Locale, string>> = {}
      for (const [locale, story] of translations) {
        const translated = pick(story)
        if (translated !== undefined && translated.trim() !== '') {
          approved[locale as Locale] = translated.trim()
        }
      }
      entries.push({ key, english: value.trim(), approved })
    }

    add(`story.${slug}.title`, english.title, (s) => s.title)
    add(`story.${slug}.category`, english.category, (s) => s.category)
    add(`story.${slug}.description`, english.description, (s) => s.description)
    // One key per section rather than one per document: fixing a typo in one
    // paragraph should not re-translate and re-bill 2,117 words.
    const englishPieces = splitStoryBody(english.body)
    for (const piece of englishPieces) {
      if (piece.kind !== 'section' || !piece.id) continue
      const id = piece.id
      add(`story.${slug}.section.${id}.body`, piece.text, (story) => {
        const match = splitStoryBody(story.body).find(
          (other) => other.kind === 'section' && other.id === id
        )
        return match?.text
      })
    }

    proseBetween(englishPieces).forEach((piece, index) => {
      add(`story.${slug}.between.${index}`, piece.text, (story) => {
        return proseBetween(splitStoryBody(story.body))[index]?.text
      })
    })

    for (const section of english.sections) {
      add(
        `story.${slug}.section.${section.id}.label`,
        section.label,
        (story) => story.sections.find((s) => s.id === section.id)?.label
      )
    }
  }

  return entries
}

/** One story's translated text. */
export interface StoryTranslation {
  title: string
  category: string
  description: string
  /** Section label by section id, never by position. */
  sections: Readonly<Record<string, string>>
  /** Whole `<Section>` block by section id. */
  sectionBodies: Readonly<Record<string, string>>
  /** Prose between sections, in the order it appears. */
  between: readonly string[]
}

/** Attributes that name a thing rather than say something to a reader. */
const IDENTIFIER_ATTRIBUTES = new Set(['id', 'src', 'href', 'width'])

const COMPONENT = /<([A-Z][A-Za-z]*)((?:\s+[a-zA-Z][a-zA-Z0-9]*="[^"]*")*)/g
const ATTRIBUTE = /([a-zA-Z][a-zA-Z0-9]*)="([^"]*)"/g

/** Component names in the order they appear. */
function componentSequence(body: string): string[] {
  return [...body.matchAll(COMPONENT)].map((match) => match[1])
}

/**
 * The values of every identifying attribute, for the translator to protect.
 *
 * Same idea as markdown link targets: the model is told to leave these exact
 * strings alone, and the verifier refuses the result if one moved anyway.
 */
export function identifierValues(body: string): string[] {
  const found: string[] = []
  for (const [, , blob] of body.matchAll(COMPONENT)) {
    for (const [, name, value] of blob.matchAll(ATTRIBUTE)) {
      if (IDENTIFIER_ATTRIBUTES.has(name)) found.push(value)
    }
  }
  return found
}

/** Every `name="value"` whose name identifies rather than describes. */
function identifiers(body: string): string[] {
  const found: string[] = []
  for (const [, component, blob] of body.matchAll(COMPONENT)) {
    for (const [, name, value] of blob.matchAll(ATTRIBUTE)) {
      if (IDENTIFIER_ATTRIBUTES.has(name))
        found.push(`${component}.${name}=${value}`)
    }
  }
  return found
}

function quote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * A complete `.mdx` file for a translated story.
 *
 * `cover`, `order` and `readMore` are copied from the English frontmatter
 * verbatim — a URL and a sort key, which the Chinese files leave untouched too.
 * Section ids come from English and only their labels are replaced, so the
 * body's `<Section id>` anchors keep pointing at something.
 */
export function buildStory(
  english: Story,
  translation: StoryTranslation
): string {
  const carry = (field: string): string | undefined => {
    const match = new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm').exec(
      english.frontmatter
    )
    return match ? `${field}: ${match[1]}` : undefined
  }

  const lines = [
    '---',
    `title: ${quote(translation.title)}`,
    `category: ${quote(translation.category)}`,
    `description: ${quote(translation.description)}`,
    carry('cover'),
    carry('readMore'),
    carry('order'),
    'translatedBy: machine',
    'sections:'
  ].filter((line): line is string => line !== undefined)

  for (const section of english.sections) {
    lines.push(`  - id: ${section.id}`)
    lines.push(
      `    label: ${quote(translation.sections[section.id] ?? section.label)}`
    )
  }

  // Rebuilt from the English pieces so the separators between sections are the
  // original ones. A translated piece is substituted where there is one; a
  // missing piece falls back to English rather than leaving a hole.
  let betweenIndex = 0
  const body = splitStoryBody(english.body)
    .map((piece) => {
      if (piece.kind === 'section') {
        return piece.id
          ? (translation.sectionBodies[piece.id] ?? piece.text)
          : piece.text
      }
      if (piece.text.trim() === '') return piece.text
      const translated = translation.between[betweenIndex]
      betweenIndex += 1
      if (translated === undefined) return piece.text
      // The key holds the prose alone, so the validator can compare line counts
      // against the English. The whitespace around it is structure, and comes
      // back from the English piece — without it a translated <AuthorBio> ends
      // up glued to the </Section> above it.
      const leading = /^\s*/.exec(piece.text)?.[0] ?? ''
      const trailing = /\s*$/.exec(piece.text)?.[0] ?? ''
      return `${leading}${translated.trim()}${trailing}`
    })
    .join('')

  lines.push('---', '', localizeMarkdownLinks(body.trim(), TARGET_LOCALE), '')
  return lines.join('\n')
}

/**
 * Everything that must be true of a generated story before it is written.
 *
 * The JSX is why this exists. A translated `id` breaks the table of contents,
 * a translated `src` breaks an image, and a dropped component removes content
 * outright — none of which shows up as anything but a page that quietly looks
 * wrong.
 */
export function verifyStory(english: Story, built: string): string[] {
  const problems: string[] = []
  const generated = parseStory(`ja/${english.slug}`, built)

  if (!generated.machineWritten) {
    problems.push('no `translatedBy: machine` marker')
  }

  const englishIds = english.sections.map((section) => section.id)
  const builtIds = generated.sections.map((section) => section.id)
  if (englishIds.join(',') !== builtIds.join(',')) {
    problems.push(`section ids changed: ${englishIds} became ${builtIds}`)
  }

  for (const section of english.sections) {
    const label = generated.sections.find((s) => s.id === section.id)?.label
    if (label === undefined) {
      problems.push(`section ${section.id}: label missing`)
    } else if (label === section.label && section.label.trim() !== '') {
      problems.push(`section ${section.id}: label still English`)
    }
  }

  const before = componentSequence(english.body)
  const after = componentSequence(generated.body)
  if (before.join(',') !== after.join(',')) {
    const missing = before.filter((name, i) => after[i] !== name)
    problems.push(
      `component sequence changed near ${missing[0] ?? '(end)'}: ` +
        `${before.length} components became ${after.length}`
    )
  }

  const beforeIds = identifiers(english.body)
  const afterIds = identifiers(generated.body)
  for (const identifier of beforeIds) {
    if (!afterIds.includes(identifier))
      problems.push(`lost or altered ${identifier}`)
  }

  if (generated.body.trim() === english.body.trim()) {
    problems.push('body is still English')
  }
  if (generated.title.trim() === english.title.trim()) {
    problems.push('title is still English')
  }

  return problems
}

/** Every `.mdx` under `src/content/customers`, as `<locale>/<slug>`. */
export function readStories(): Story[] {
  const stories: Story[] = []
  for (const locale of readdirSync(CUSTOMERS_DIR)) {
    const localeDir = join(CUSTOMERS_DIR, locale)
    if (!statSync(localeDir).isDirectory()) continue

    for (const file of readdirSync(localeDir).sort()) {
      if (!file.endsWith('.mdx')) continue
      const slug = file.replace(/\.mdx$/, '')
      stories.push(
        parseStory(
          `${locale}/${slug}`,
          readFileSync(join(localeDir, file), 'utf8')
        )
      )
    }
  }
  return stories
}

export const storyAdapter: SourceAdapter = {
  name: 'story',

  read(): SourceEntry[] {
    return entriesFromStories(readStories())
  }
}
