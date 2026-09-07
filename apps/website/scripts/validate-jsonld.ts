import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { collectGraphIds } from '../src/utils/jsonLd'

const DIST_DIR = join(process.cwd(), 'dist')
const JSON_LD_BLOCK =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

interface Violation {
  file: string
  message: string
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith('.html'))
    .map((entry) => join(dir, entry))
}

function typesOf(node: Record<string, unknown>): string[] {
  const type = node['@type']
  if (typeof type === 'string') return [type]
  if (Array.isArray(type)) {
    return type.filter((t): t is string => typeof t === 'string')
  }
  return []
}

function hasValidPrice(node: Record<string, unknown>): boolean {
  const price = node.price
  const priceStr = price == null ? '' : String(price).trim()
  return priceStr !== '' && !Number.isNaN(Number(priceStr))
}

function checkHonesty(
  value: unknown,
  file: string,
  violations: Violation[]
): void {
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    const types = typesOf(record)
    if (types.includes('Review') || types.includes('AggregateRating')) {
      violations.push({
        file,
        message: `dishonest node type ${types.join('/')}`
      })
    }
    if ('aggregateRating' in record || 'review' in record) {
      violations.push({
        file,
        message: 'node carries a review/aggregateRating'
      })
    }
    if (
      types.includes('Offer') &&
      (!hasValidPrice(record) || !record.priceCurrency)
    ) {
      violations.push({
        file,
        message: 'Offer missing priceCurrency or a concrete price'
      })
    }
    Object.values(record).forEach(walk)
  }
  walk(value)
}

function validateFile(file: string): Violation[] {
  const html = readFileSync(file, 'utf8')
  const violations: Violation[] = []
  const definedIds = new Set<string>()
  const referencedIds: string[] = []

  for (const match of html.matchAll(JSON_LD_BLOCK)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1])
    } catch (error) {
      violations.push({ file, message: `invalid JSON-LD: ${String(error)}` })
      continue
    }
    checkHonesty(parsed, file, violations)
    const { defined, references } = collectGraphIds(parsed)
    defined.forEach((id) => definedIds.add(id))
    referencedIds.push(...references)
  }

  for (const id of referencedIds) {
    if (!definedIds.has(id)) {
      violations.push({ file, message: `unresolved @id reference: ${id}` })
    }
  }

  return violations
}

function main(): void {
  const files = htmlFiles(DIST_DIR)

  if (files.length === 0) {
    console.error(
      `JSON-LD validation found no HTML in ${DIST_DIR} — build first.`
    )
    process.exit(1)
  }

  const violations = files.flatMap(validateFile)
  if (violations.length > 0) {
    console.error(`JSON-LD validation failed (${violations.length} issue(s)):`)
    for (const { file, message } of violations) {
      console.error(`  ${file.replace(DIST_DIR, 'dist')}: ${message}`)
    }
    process.exit(1)
  }

  process.stdout.write(
    `JSON-LD validation passed across ${files.length} page(s).\n`
  )
}

main()
