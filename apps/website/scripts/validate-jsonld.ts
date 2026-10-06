import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { NON_DEFAULT_LOCALE_PREFIXES } from '@/config/locales'
import { collectGraphIds } from '@/utils/jsonLd'

import { isDirectExecution } from './script-entry-point'

const SITE_ORIGIN = 'https://comfy.org'
const JSON_LD_BLOCK =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const CANONICAL =
  /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2})))?$/
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MAX_OFFSET_MINUTES = 14 * 60
const VIDEO_FILE = /\.(mp4|webm|mov)(\?|#|$)/i
const PLACEHOLDER = /^(undefined|null|NaN|\[object Object\])$/
const DECIMAL = /^\d+(\.\d+)?$/
const MODEL_PAGE = new RegExp(
  `^(?:${NON_DEFAULT_LOCALE_PREFIXES.join('|')})?/(?:hub/)?models/(?!local/)[^/]+/`
)
const REFERENCE_RULES = new Set(['honesty', 'idsOnSite', 'noPlaceholders'])
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
  if (Array.isArray(value)) return value.every(isBlank)
  return value == null || (typeof value === 'string' && value.trim() === '')
}

function isAbsoluteHttpUrl(value: unknown): boolean {
  return typeof value === 'string' && /^https?:\/\/[^/]/.test(value)
}

function show(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function locatorOf(node: JsonLdRecord): string {
  const id = node['@id']
  return typeof id === 'string' ? id : typesOf(node).join('/') || '(untyped)'
}

function missing(node: JsonLdRecord, fields: string[]): string[] {
  const type = typesOf(node).join('/')
  return fields
    .filter((field) => isBlank(node[field]))
    .map((field) => `${type} missing ${field}`)
}

function isIdReference(node: JsonLdRecord): boolean {
  return (
    typeof node['@id'] === 'string' &&
    Object.keys(node).every((key) => key === '@id' || key === '@type')
  )
}

function isOnSite(id: string): boolean {
  return id.startsWith(`${SITE_ORIGIN}/`)
}

function pointsElsewhere(node: JsonLdRecord, page: PageContext): boolean {
  return isIdReference(node) && page.nodesById.get(String(node['@id'])) !== node
}

function resolve(value: unknown, page: PageContext): JsonLdRecord | undefined {
  if (!isRecord(value)) return undefined
  const id = value['@id']
  if (isIdReference(value) && typeof id === 'string') {
    return page.nodesById.get(id) ?? value
  }
  return value
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function isoDate(value: unknown): { hasTime: boolean } | undefined {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null
  if (!match) return undefined
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] =
    match.slice(1).map((part: string | undefined) => Number(part ?? 0))
  if (month < 1 || month > 12) return undefined
  const monthDays = month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1]
  const isReal =
    day >= 1 &&
    day <= monthDays &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetMinute <= 59 &&
    offsetHour * 60 + offsetMinute <= MAX_OFFSET_MINUTES
  return isReal ? { hasTime: match[0].includes('T') } : undefined
}

function isConcretePrice(price: unknown): boolean {
  if (typeof price === 'number') return Number.isFinite(price) && price >= 0
  return typeof price === 'string' && DECIMAL.test(price.trim())
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
  const specification = asList(node.priceSpecification).find(isRecord)
  const price = node.price ?? specification?.price
  const currency = node.priceCurrency ?? specification?.priceCurrency
  if (
    !isConcretePrice(price) ||
    typeof currency !== 'string' ||
    isBlank(currency)
  ) {
    return [
      `Offer missing priceCurrency or a concrete price: price ${show(price)}, priceCurrency ${show(currency)}`
    ]
  }
  if (MODEL_PAGE.test(page.pagePath) && Number(price) === 0) {
    return [`model page Offer has a zero price ${show(price)}`]
  }
  return []
}

const product: Rule = (node, page) => {
  if (!typesOf(node).includes('Product')) return []
  const problems = missing(node, ['name', 'image', 'offers'])
  if (isBlank(node.brand)) return problems
  const brand = resolve(node.brand, page)
  const brandTypes = brand ? typesOf(brand) : []
  if (!brandTypes.some((type) => type === 'Brand' || type === 'Organization')) {
    problems.push(
      `Product brand ${show(node.brand)} is not a Brand or Organization`
    )
  }
  return problems
}

const video: Rule = (node) => {
  if (!typesOf(node).includes('VideoObject')) return []
  const problems = missing(node, ['name', 'thumbnailUrl', 'uploadDate'])
  const { uploadDate } = node
  if (!isBlank(uploadDate) && !isoDate(uploadDate)?.hasTime) {
    problems.push(
      `VideoObject uploadDate ${show(uploadDate)} is not a real date-time with offset`
    )
  }
  return problems
}

const event: Rule = (node) => {
  if (!typesOf(node).includes('Event')) return []
  const { startDate } = node
  return isoDate(startDate)
    ? []
    : [`Event startDate ${show(startDate)} is not a real ISO 8601 date`]
}

const imagesAreImages: Rule = (node) => {
  const isImageObject = typesOf(node).includes('ImageObject')
  const urls = [
    ...asList(node.image),
    ...asList(node.thumbnailUrl),
    ...(isImageObject ? [...asList(node.url), ...asList(node.contentUrl)] : [])
  ].filter((url): url is string => typeof url === 'string')
  return urls
    .filter((url) => VIDEO_FILE.test(url))
    .map((url) => `video file used as an image: ${url}`)
}

function crumbUrl(item: unknown): unknown {
  return isRecord(item) ? item['@id'] : item
}

function crumbName(crumb: JsonLdRecord): unknown {
  return crumb.name ?? (isRecord(crumb.item) ? crumb.item.name : undefined)
}

const breadcrumb: Rule = (node) => {
  if (!typesOf(node).includes('BreadcrumbList')) return []
  const items = asList(node.itemListElement)
  const malformed = items.flatMap((item, index) =>
    isRecord(item)
      ? []
      : [`BreadcrumbList entry ${index + 1} is not a ListItem`]
  )
  const crumbs = items
    .filter(isRecord)
    .toSorted((a, b) => Number(a.position) - Number(b.position))
  return [
    ...malformed,
    ...crumbs.flatMap((crumb, index) => {
      const label = `BreadcrumbList item ${index + 1}`
      const problems: string[] = []
      if (crumb.position !== index + 1) {
        problems.push(`${label} has position ${show(crumb.position)}`)
      }
      if (isBlank(crumbName(crumb))) problems.push(`${label} has no name`)
      const isLast = index === crumbs.length - 1
      if (!isLast && !isAbsoluteHttpUrl(crumbUrl(crumb.item))) {
        problems.push(`${label} has no absolute item URL`)
      }
      return problems
    })
  ]
}

const itemList: Rule = (node) => {
  if (!typesOf(node).includes('ItemList') || !('numberOfItems' in node)) {
    return []
  }
  const count = asList(node.itemListElement).length
  return node.numberOfItems === count
    ? []
    : [`ItemList numberOfItems ${show(node.numberOfItems)} but ${count} listed`]
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
    problems.push(`WebPage url ${show(node.url)} does not match canonical`)
  }
  return problems
}

const idsOnSite: Rule = (node) => {
  const id = node['@id']
  if (typeof id !== 'string') return []
  if (id.includes('#') && !isOnSite(id)) {
    return [`fragment @id ${id} is not on ${SITE_ORIGIN}`]
  }
  return isAbsoluteHttpUrl(id) ? [] : [`@id ${id} is not an absolute URL`]
}

const isPlaceholder = (value: unknown): boolean =>
  typeof value === 'string' &&
  (value.trim() === '' || PLACEHOLDER.test(value.trim()))

const noPlaceholders: Rule = (node) =>
  Object.entries(node)
    .filter(([, value]) => asList(value).some(isPlaceholder))
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
  const stubsById = new Map<string, JsonLdRecord>()
  const definitionsById = new Map<string, JsonLdRecord>()
  for (const block of blocks) {
    const { defined, references } = collectGraphIds(block)
    defined.forEach((id) => definedIds.add(id))
    referencedIds.push(...references)
    eachNode(block, (node) => {
      const id = node['@id']
      if (typeof id !== 'string') return
      if (isIdReference(node)) {
        if ('@type' in node && !stubsById.has(id)) stubsById.set(id, node)
        return
      }
      if (definitionsById.has(id)) {
        violations.push({
          rule: 'duplicateIds',
          message: `@id ${id} defined twice`
        })
      }
      definitionsById.set(id, node)
    })
  }

  const page: PageContext = {
    pagePath,
    canonical: html.match(CANONICAL)?.[1],
    nodesById: new Map([...stubsById, ...definitionsById])
  }
  for (const block of blocks) {
    eachNode(block, (node) => {
      const isReference = pointsElsewhere(node, page)
      for (const [rule, check] of Object.entries(RULES)) {
        if (isReference && !REFERENCE_RULES.has(rule)) continue
        for (const message of check(node, page)) {
          violations.push({ rule, message: `${locatorOf(node)}: ${message}` })
        }
      }
    })
  }

  for (const id of referencedIds) {
    if (!definedIds.has(id) && isOnSite(id)) {
      violations.push({ rule: 'idRefs', message: `unresolved @id: ${id}` })
    }
  }
  return violations
}

function htmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith('.html'))
    .map((entry) => join(dir, entry))
}

function pagePathOf(distDir: string, file: string): string {
  const rel = relative(distDir, file).split(sep).join('/')
  return `/${rel.replace(/index\.html$/, '')}`
}

export function main(distDir: string): number {
  const files = htmlFiles(distDir)

  if (files.length === 0) {
    console.error(
      `JSON-LD validation found no HTML in ${distDir} — build first.`
    )
    return 1
  }

  const pages = files.map((file) => ({
    pagePath: pagePathOf(distDir, file),
    html: readFileSync(file, 'utf8')
  }))
  if (!pages.some(({ html }) => CANONICAL.test(html))) {
    console.error(
      `JSON-LD validation found no canonical link in ${distDir}, so the WebPage check cannot run. Build with build:e2e.`
    )
    return 1
  }

  const failures = pages.flatMap(({ pagePath, html }) =>
    validateHtml(html, pagePath).map((violation) => ({
      pagePath,
      ...violation
    }))
  )
  if (failures.length > 0) {
    console.error(`JSON-LD validation failed (${failures.length} issue(s)):`)
    for (const { pagePath, rule, message } of failures) {
      console.error(`  ${pagePath} [${rule}]: ${message}`)
    }
    return 1
  }

  const withJsonLd = pages.filter(({ html }) =>
    html.includes('application/ld+json')
  ).length
  process.stdout.write(
    `JSON-LD validation passed across ${pages.length} page(s), ${withJsonLd} with JSON-LD.\n`
  )
  return 0
}

if (isDirectExecution(process.argv[1], import.meta.filename)) {
  process.exitCode = main(join(process.cwd(), 'dist'))
}
