import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse, stringify } from 'yaml'

export interface CustomersFrontmatter {
  title: string
  category: string
  description: string
  cover: string
  readMore?: string
  order: number
  sections: { id: string; label: string }[]
}

export interface FaqFrontmatter {
  question: string
  order: number
}

type DocumentKind = 'customers' | 'faq'

export interface DocumentRef {
  id: string
  kind: DocumentKind
  enPath: string
  localePath: (locale: string) => string
}

export interface TranslatableField {
  path: string
  value: string
}

export interface ParsedDocument<Frontmatter> {
  frontmatter: Frontmatter
  body: string
}

export interface BodySegment {
  translatable: boolean
  text: string
}

const sectionPattern = /<Section\b[^<>]*>[\s\S]*?<\/Section>/g

// A customer story's body can run well past a single translation request's
// character budget (longest today: ~15KB), but each <Section> within it is
// small (longest today: ~4.8KB). Splitting on that existing structural
// boundary keeps every translation request comfortably sized without
// inventing an arbitrary character-based cut that could land mid-sentence or
// mid-component. A body with no <Section> tags (FAQ answers) is one segment.
export function splitBody(body: string): BodySegment[] {
  const matches = [...body.matchAll(sectionPattern)]
  if (matches.length === 0) return [{ translatable: true, text: body }]

  const segments: BodySegment[] = []
  let cursor = 0
  for (const match of matches) {
    const index = match.index ?? 0
    if (index > cursor) {
      segments.push({ translatable: false, text: body.slice(cursor, index) })
    }
    segments.push({ translatable: true, text: match[0] })
    cursor = index + match[0].length
  }
  if (cursor < body.length) {
    segments.push({ translatable: false, text: body.slice(cursor) })
  }
  return segments
}

export function joinBody(segments: readonly BodySegment[]): string {
  return segments.map((segment) => segment.text).join('')
}

const mdxTagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9._-]*)([^<>]*)>/g

// Astro compiles a generated .mdx file as JSX at build time, and nothing in
// this pipeline otherwise runs that compiler before a translation is
// committed. This is a syntax heuristic, not a substitute for it: it catches
// the two failure shapes an LLM actually produces (a dropped/mismatched
// closing tag, an unbalanced `{`/`}` from stray JSX-looking text) without
// taking on a full MDX/JSX parser as a dependency.
export function findMdxSyntaxErrors(body: string): string[] {
  const stack: string[] = []
  const errors: string[] = []
  for (const [, closing, name, attrs] of body.matchAll(mdxTagPattern)) {
    if (attrs.trimEnd().endsWith('/')) continue
    if (!closing) {
      stack.push(name)
      continue
    }
    const open = stack.pop()
    if (open !== name) {
      errors.push(
        open
          ? `</${name}> does not match the open <${open}>`
          : `</${name}> has no matching open tag`
      )
    }
  }
  for (const unclosed of stack) errors.push(`<${unclosed}> is never closed`)

  let braceDepth = 0
  for (const char of body) {
    if (char === '{') braceDepth++
    else if (char === '}') braceDepth--
    if (braceDepth < 0) {
      errors.push('unbalanced braces: unexpected }')
      break
    }
  }
  if (braceDepth > 0) errors.push(`unbalanced braces: ${braceDepth} unclosed {`)

  return errors
}

const frontmatterFence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

export function parseDocument<Frontmatter>(
  raw: string
): ParsedDocument<Frontmatter> {
  const match = frontmatterFence.exec(raw)
  if (!match) throw new Error('document is missing a frontmatter fence')
  return { frontmatter: parse(match[1]) as Frontmatter, body: match[2] }
}

export function serializeDocument(frontmatter: unknown, body: string): string {
  // body is reproduced exactly as parseDocument captured it (including its
  // leading blank line) — trimming it would turn a body that starts with an
  // indented Markdown code block into plain prose.
  return `---\n${stringify(frontmatter).trimEnd()}\n---\n${body}`
}

export function customersTranslatableFields(
  frontmatter: CustomersFrontmatter
): TranslatableField[] {
  return [
    { path: 'title', value: frontmatter.title },
    { path: 'category', value: frontmatter.category },
    { path: 'description', value: frontmatter.description },
    ...frontmatter.sections.map((section, index) => ({
      path: `sections.${index}.label`,
      value: section.label
    }))
  ]
}

export function applyCustomersTranslations(
  frontmatter: CustomersFrontmatter,
  translations: ReadonlyMap<string, string>
): CustomersFrontmatter {
  return {
    ...frontmatter,
    title: translations.get('title') ?? frontmatter.title,
    category: translations.get('category') ?? frontmatter.category,
    description: translations.get('description') ?? frontmatter.description,
    sections: frontmatter.sections.map((section, index) => ({
      ...section,
      label: translations.get(`sections.${index}.label`) ?? section.label
    }))
  }
}

export function faqTranslatableFields(
  frontmatter: FaqFrontmatter
): TranslatableField[] {
  return [{ path: 'question', value: frontmatter.question }]
}

export function applyFaqTranslations(
  frontmatter: FaqFrontmatter,
  translations: ReadonlyMap<string, string>
): FaqFrontmatter {
  return {
    ...frontmatter,
    question: translations.get('question') ?? frontmatter.question
  }
}

function mdxFilenames(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
    .map((entry) => entry.name)
}

export function discoverDocuments(contentDir: string): DocumentRef[] {
  const customersDir = join(contentDir, 'customers', 'en')
  const customers: DocumentRef[] = mdxFilenames(customersDir).map(
    (filename) => {
      const slug = filename.slice(0, -'.mdx'.length)
      return {
        id: `customers/${slug}`,
        kind: 'customers' as const,
        enPath: join(customersDir, filename),
        localePath: (locale: string) =>
          join(contentDir, 'customers', locale, filename)
      }
    }
  )

  const faqRoot = join(contentDir, 'faq')
  const categories = existsSync(faqRoot)
    ? readdirSync(faqRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : []
  const faq: DocumentRef[] = categories.flatMap((category) =>
    mdxFilenames(join(faqRoot, category, 'en')).map((filename) => ({
      id: `faq/${category}/${filename.slice(0, -'.mdx'.length)}`,
      kind: 'faq' as const,
      enPath: join(faqRoot, category, 'en', filename),
      localePath: (locale: string) => join(faqRoot, category, locale, filename)
    }))
  )

  return [...customers, ...faq].sort((a, b) => a.id.localeCompare(b.id))
}

export function readDocument(ref: DocumentRef, path: string) {
  const raw = readFileSync(path, 'utf8')
  return ref.kind === 'customers'
    ? parseDocument<CustomersFrontmatter>(raw)
    : parseDocument<FaqFrontmatter>(raw)
}

export function translatableFields(
  ref: DocumentRef,
  frontmatter: CustomersFrontmatter | FaqFrontmatter
): TranslatableField[] {
  return ref.kind === 'customers'
    ? customersTranslatableFields(frontmatter as CustomersFrontmatter)
    : faqTranslatableFields(frontmatter as FaqFrontmatter)
}

export function applyFrontmatterTranslations(
  ref: DocumentRef,
  frontmatter: CustomersFrontmatter | FaqFrontmatter,
  translations: ReadonlyMap<string, string>
): CustomersFrontmatter | FaqFrontmatter {
  return ref.kind === 'customers'
    ? applyCustomersTranslations(
        frontmatter as CustomersFrontmatter,
        translations
      )
    : applyFaqTranslations(frontmatter as FaqFrontmatter, translations)
}
