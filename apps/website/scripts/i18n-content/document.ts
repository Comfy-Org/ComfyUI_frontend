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

const frontmatterFence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

export function parseDocument<Frontmatter>(
  raw: string
): ParsedDocument<Frontmatter> {
  const match = frontmatterFence.exec(raw)
  if (!match) throw new Error('document is missing a frontmatter fence')
  return { frontmatter: parse(match[1]) as Frontmatter, body: match[2] }
}

export function serializeDocument(frontmatter: unknown, body: string): string {
  return `---\n${stringify(frontmatter).trimEnd()}\n---\n\n${body.trimStart()}`
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

export function discoverDocuments(contentDir: string): DocumentRef[] {
  const customersDir = join(contentDir, 'customers', 'en')
  const customers: DocumentRef[] = existsSync(customersDir)
    ? readdirSync(customersDir)
        .filter((filename) => filename.endsWith('.mdx'))
        .map((filename) => {
          const slug = filename.slice(0, -'.mdx'.length)
          return {
            id: `customers/${slug}`,
            kind: 'customers' as const,
            enPath: join(customersDir, filename),
            localePath: (locale: string) =>
              join(contentDir, 'customers', locale, filename)
          }
        })
    : []

  const faqRoot = join(contentDir, 'faq')
  const categories = existsSync(faqRoot)
    ? readdirSync(faqRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : []
  const faq: DocumentRef[] = categories.flatMap((category) => {
    const enDir = join(faqRoot, category, 'en')
    if (!existsSync(enDir)) return []
    return readdirSync(enDir)
      .filter((filename) => filename.endsWith('.mdx'))
      .map((filename) => ({
        id: `faq/${category}/${filename.slice(0, -'.mdx'.length)}`,
        kind: 'faq' as const,
        enPath: join(faqRoot, category, 'en', filename),
        localePath: (locale: string) =>
          join(faqRoot, category, locale, filename)
      }))
  })

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
