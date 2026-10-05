import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { collectGraphIds } from '@/utils/jsonLd'

import { isDirectExecution } from './script-entry-point'

const SITE_ORIGIN = 'https://comfy.org'
const JSON_LD_BLOCK =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const CANONICAL = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
const FULL_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}:\d{2}|Z)$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const VIDEO_FILE = /\.(mp4|webm|mov)(\?|#|$)/i
const PLACEHOLDER = /^(undefined|null|NaN)$/
const WEB_PAGE_TYPES = [
  'WebPage',
  'AboutPage',
  'ContactPage',
  'CollectionPage',
  'ProfilePage'
]

type JsonLdRecord = Record<string, unknown>

interface PageContext {
  pagePath: string
  canonical: string | undefined
  nodesById: Map<string, JsonLdRecord>
}

export interface Violation {
  rule: string
  message: string
}

type Rule = (node: JsonLdRecord, page: PageContext) => string[]

function typesOf(node: JsonLdRecord): string[] {
  const type = node['@type']
  if (typeof type === 'string') return [type]
  if (Array.isArray(type)) {
    return type.filter((t): t is string => typeof t === 'string')
  }
  return []
}

function isRecord(value: unknown): value is JsonLdRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asList(value: unknown): unknown[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '')
}

function isAbsoluteHttpUrl(value: unknown): boolean {
  return typeof value === 'string' && /^https?:\/\/[^/]/.test(value)
}

function missing(node: JsonLdRecord, fields: string[]): string[] {
  const type = typesOf(node).join('/')
  return fields
    .filter((field) => isBlank(node[field]))
    .map((field) => `${type} missing ${field}`)
}

function resolve(value: unknown, page: PageContext): JsonLdRecord | undefined {
  if (!isRecord(value)) return undefined
  const id = value['@id']
  if (typeof id === 'string' && Object.keys(value).length === 1) {
    return page.nodesById.get(id)
  }
  return value
}

function isModelPage(pagePath: string): boolean {
  return /^\/(hub\/)?models\/[^/]+\//.test(pagePath)
}

const honesty: Rule = (node) => {
  const types = typesOf(node)
  const problems: string[] = []
  if (types.includes('Review') || types.includes('AggregateRating')) {
    problems.push(`dishonest node type ${types.join('/')}`)
  }
  if ('aggregateRating' in node || 'review' in node) {
    problems.push('node carries a review/aggregateRating')
  }
  return problems
}

const offer: Rule = (node, page) => {
  if (!typesOf(node).includes('Offer')) return []
  const price = isBlank(node.price) ? NaN : Number(String(node.price).trim())
  if (Number.isNaN(price) || isBlank(node.priceCurrency)) {
    return ['Offer missing priceCurrency or a concrete price']
  }
  if (isModelPage(page.pagePath) && price <= 0) {
    return [`model page Offer has a non-positive price ${String(node.price)}`]
  }
  return []
}

const product: Rule = (node, page) => {
  if (!typesOf(node).includes('Product')) return []
  const problems = missing(node, ['name', 'image', 'offers'])
  const brand = resolve(node.brand, page)
  const brandTypes = brand ? typesOf(brand) : []
  if (!brandTypes.some((type) => type === 'Brand' || type === 'Organization')) {
    problems.push('Product brand is not a Brand or Organization')
  }
  return problems
}

const video: Rule = (node) => {
  if (!typesOf(node).includes('VideoObject')) return []
  const problems = missing(node, ['name', 'thumbnailUrl', 'uploadDate'])
  const { uploadDate } = node
  if (!isBlank(uploadDate) && !FULL_DATE_TIME.test(String(uploadDate))) {
    problems.push(
      `VideoObject uploadDate ${String(uploadDate)} lacks a time and offset`
    )
  }
  return problems
}

const event: Rule = (node) => {
  if (!typesOf(node).includes('Event')) return []
  const startDate = String(node.startDate ?? '')
  return DATE_ONLY.test(startDate) || FULL_DATE_TIME.test(startDate)
    ? []
    : [
        `Event startDate ${startDate || '(missing)'} is not ISO 8601 with offset`
      ]
}

const imagesAreImages: Rule = (node) => {
  const isImageObject = typesOf(node).includes('ImageObject')
  const urls = [
    ...asList(node.image),
    ...asList(node.thumbnailUrl),
    ...(isImageObject ? [node.url, node.contentUrl] : [])
  ].filter((url): url is string => typeof url === 'string')
  return urls
    .filter((url) => VIDEO_FILE.test(url))
    .map((url) => `video file used as an image: ${url}`)
}

const breadcrumb: Rule = (node) => {
  if (!typesOf(node).includes('BreadcrumbList')) return []
  const items = asList(node.itemListElement).filter(isRecord)
  return items.flatMap((item, index) => {
    const problems: string[] = []
    if (item.position !== index + 1) {
      problems.push(
        `BreadcrumbList item ${index + 1} has position ${String(item.position)}`
      )
    }
    const isLast = index === items.length - 1
    if (!isLast && !isAbsoluteHttpUrl(item.item)) {
      problems.push(`BreadcrumbList item ${index + 1} has no absolute item URL`)
    }
    return problems
  })
}

const itemList: Rule = (node) => {
  if (!typesOf(node).includes('ItemList') || !('numberOfItems' in node)) {
    return []
  }
  const count = asList(node.itemListElement).length
  return node.numberOfItems === count
    ? []
    : [
        `ItemList numberOfItems ${String(node.numberOfItems)} but ${count} listed`
      ]
}

const webPage: Rule = (node, page) => {
  const id = node['@id']
  const isPageNode =
    typesOf(node).some((type) => WEB_PAGE_TYPES.includes(type)) &&
    typeof id === 'string' &&
    id.endsWith('#webpage')
  if (!isPageNode || !page.canonical) return []
  const problems: string[] = []
  if (id !== `${page.canonical}#webpage`) {
    problems.push(`WebPage @id ${id} does not match canonical`)
  }
  if (node.url !== page.canonical) {
    problems.push(`WebPage url ${String(node.url)} does not match canonical`)
  }
  return problems
}

const idsOnSite: Rule = (node) => {
  const id = node['@id']
  if (typeof id !== 'string') return []
  return id.startsWith(`${SITE_ORIGIN}/`)
    ? []
    : [`@id ${id} is not an absolute ${SITE_ORIGIN} URL`]
}

const noPlaceholders: Rule = (node) =>
  Object.entries(node)
    .filter(
      ([, value]) =>
        typeof value === 'string' &&
        (value.trim() === '' || PLACEHOLDER.test(value.trim()))
    )
    .map(([key, value]) => `${key} is ${JSON.stringify(value)}`)

const RULES: Record<string, Rule> = {
  honesty,
  offer,
  product,
  video,
  event,
  imagesAreImages,
  breadcrumb,
  itemList,
  webPage,
  idsOnSite,
  noPlaceholders
}

function eachNode(value: unknown, visit: (node: JsonLdRecord) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => eachNode(item, visit))
    return
  }
  if (!isRecord(value)) return
  visit(value)
  Object.values(value).forEach((child) => eachNode(child, visit))
}

export function validateHtml(html: string, pagePath: string): Violation[] {
  const violations: Violation[] = []
  const blocks: unknown[] = []
  for (const match of html.matchAll(JSON_LD_BLOCK)) {
    try {
      blocks.push(JSON.parse(match[1]))
    } catch (error) {
      violations.push({ rule: 'json', message: `invalid JSON-LD: ${error}` })
    }
  }

  const definedIds = new Set<string>()
  const referencedIds: string[] = []
  const nodesById = new Map<string, JsonLdRecord>()
  for (const block of blocks) {
    const { defined, references } = collectGraphIds(block)
    defined.forEach((id) => definedIds.add(id))
    referencedIds.push(...references)
    eachNode(block, (node) => {
      const id = node['@id']
      if (typeof id !== 'string' || Object.keys(node).length === 1) return
      if (nodesById.has(id)) {
        violations.push({
          rule: 'duplicateIds',
          message: `@id ${id} defined twice`
        })
      }
      nodesById.set(id, node)
    })
  }

  const page: PageContext = {
    pagePath,
    canonical: html.match(CANONICAL)?.[1],
    nodesById
  }
  for (const block of blocks) {
    eachNode(block, (node) => {
      for (const [rule, check] of Object.entries(RULES)) {
        for (const message of check(node, page)) {
          violations.push({ rule, message })
        }
      }
    })
  }

  for (const id of referencedIds) {
    if (!definedIds.has(id)) {
      violations.push({ rule: 'idRefs', message: `unresolved @id: ${id}` })
    }
  }
  return violations
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith('.html'))
    .map((entry) => join(dir, entry))
}

function pagePathOf(distDir: string, file: string): string {
  const rel = relative(distDir, file).split(sep).join('/')
  return `/${rel.replace(/index\.html$/, '')}`
}

function main(): void {
  const distDir = join(process.cwd(), 'dist')
  const files = htmlFiles(distDir)

  if (files.length === 0) {
    console.error(
      `JSON-LD validation found no HTML in ${distDir} — build first.`
    )
    process.exit(1)
  }

  const failures = files.flatMap((file) => {
    const pagePath = pagePathOf(distDir, file)
    return validateHtml(readFileSync(file, 'utf8'), pagePath).map(
      (violation) => ({ pagePath, ...violation })
    )
  })
  if (failures.length > 0) {
    console.error(`JSON-LD validation failed (${failures.length} issue(s)):`)
    for (const { pagePath, rule, message } of failures) {
      console.error(`  ${pagePath} [${rule}]: ${message}`)
    }
    process.exit(1)
  }

  process.stdout.write(
    `JSON-LD validation passed across ${files.length} page(s).\n`
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
