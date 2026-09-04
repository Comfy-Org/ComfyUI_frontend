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

const mdxTagPattern =
  /<(\/?)([a-zA-Z][a-zA-Z0-9._-]*)((?:"[^"]*"|'[^']*'|[^<>])*)>/g

// A lazy `<Tag>...</Tag>` regex stops at the first same-name close it finds,
// which is the wrong one once a component nests inside itself (e.g. a
// <Section> containing another <Section>). Walking mdxTagPattern with a
// stack finds each top-level block's true matching close regardless of
// nesting, reusing the same quote-aware tag scan findMdxSyntaxErrors uses.
function findTopLevelBlocks(body: string): { start: number; end: number }[] {
  const blocks: { start: number; end: number }[] = []
  const stack: { name: string; start: number }[] = []
  for (const match of body.matchAll(mdxTagPattern)) {
    const [full, closing, name, attrs] = match
    if (attrs.trimEnd().endsWith('/')) continue
    const index = match.index ?? 0
    if (!closing) {
      stack.push({ name, start: index })
      continue
    }
    const open = stack.pop()
    if (!open || open.name !== name) continue
    if (stack.length === 0) {
      blocks.push({ start: open.start, end: index + full.length })
    }
  }
  return blocks
}

// bio fields are the one place prose lives inside a component's JSX
// attribute expression rather than as tag children: <AuthorBio people={[{
// ..., bio: `text` }]} /> is self-closing, so it never yields a block.
const bioFieldPattern = /\bbio:\s*`([^`]*)`/g

function splitBioFields(text: string): BodySegment[] {
  const segments: BodySegment[] = []
  let cursor = 0
  for (const match of text.matchAll(bioFieldPattern)) {
    const index = match.index ?? 0
    const innerStart = index + match[0].length - match[1].length - 1
    const innerEnd = innerStart + match[1].length
    if (innerStart > cursor) {
      segments.push({
        translatable: false,
        text: text.slice(cursor, innerStart)
      })
    }
    if (match[1].length > 0) {
      segments.push({ translatable: true, text: match[1] })
    }
    cursor = innerEnd
  }
  if (cursor < text.length) {
    segments.push({ translatable: false, text: text.slice(cursor) })
  }
  return segments.length > 0 ? segments : [{ translatable: false, text }]
}

// A customer story's body can run well past a single translation request's
// character budget (longest today: ~15KB), but each <Section> or <AuthorBio>
// within it is small (longest today: ~4.8KB). Splitting on that existing
// structural boundary keeps every translation request comfortably sized
// without inventing an arbitrary character-based cut that could land
// mid-sentence or mid-component. A body with no such tags (FAQ answers) is
// one segment.
export function splitBody(body: string): BodySegment[] {
  const blocks = findTopLevelBlocks(body)
  if (blocks.length === 0) {
    // A body with no open/close block (e.g. one standalone self-closing
    // <AuthorBio .../>) still needs its bio: fields extracted; plain prose
    // with no tags at all has nothing for splitBioFields to find and should
    // stay translatable in full rather than fall back to its "no match"
    // default of non-translatable.
    return [...body.matchAll(mdxTagPattern)].length > 0
      ? splitBioFields(body)
      : [{ translatable: true, text: body }]
  }

  const segments: BodySegment[] = []
  let cursor = 0
  for (const block of blocks) {
    if (block.start > cursor) {
      segments.push(...splitBioFields(body.slice(cursor, block.start)))
    }
    segments.push({
      translatable: true,
      text: body.slice(block.start, block.end)
    })
    cursor = block.end
  }
  if (cursor < body.length) {
    segments.push(...splitBioFields(body.slice(cursor)))
  }
  return segments
}

export function joinBody(segments: readonly BodySegment[]): string {
  return segments.map((segment) => segment.text).join('')
}

// Astro compiles a generated .mdx file as JSX at build time, and nothing in
// this pipeline otherwise runs that compiler before a translation is
// committed. This is a syntax heuristic, not a substitute for it: it catches
// the two failure shapes an LLM actually produces (a dropped/mismatched
// closing tag, an unbalanced `{`/`}` from stray JSX-looking text) without
// taking on a full MDX/JSX parser as a dependency. The attrs group treats
// quoted strings as opaque so a `>` inside an attribute value (e.g.
// title="A > B") isn't mistaken for the tag's own close.
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
