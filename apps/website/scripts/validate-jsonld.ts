/**
 * Structural validator for the JSON-LD embedded in the built site.
 *
 * Runs over `dist/` after `astro build` and fails the build when structured
 * data is malformed or dishonest, so a broken `@id` graph or a fabricated
 * rating can never ship unnoticed. Checks:
 *   1. Every `application/ld+json` block is valid JSON.
 *   2. Every bare `{ "@id": ... }` reference resolves to a node that defines
 *      that `@id` on the same page.
 *   3. No `Review` / `AggregateRating` (self-serving ratings are a Google
 *      structured-data policy violation).
 *   4. Every `Offer` carries a `priceCurrency` and a concrete `price` (a real
 *      offer, never a fabricated or empty one).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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
  if (Array.isArray(type))
    return type.filter((t): t is string => typeof t === 'string')
  return []
}

function isReference(node: Record<string, unknown>): boolean {
  const keys = Object.keys(node)
  return keys.length === 1 && keys[0] === '@id'
}

function walkObjects(
  value: unknown,
  visit: (node: Record<string, unknown>) => void
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walkObjects(item, visit))
    return
  }
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    visit(node)
    Object.values(node).forEach((child) => walkObjects(child, visit))
  }
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

    walkObjects(parsed, (node) => {
      const id = node['@id']
      if (typeof id === 'string') {
        if (isReference(node)) referencedIds.push(id)
        else definedIds.add(id)
      }

      const types = typesOf(node)
      if (types.includes('Review') || types.includes('AggregateRating')) {
        violations.push({
          file,
          message: `dishonest node type ${types.join('/')}`
        })
      }
      if ('aggregateRating' in node || 'review' in node) {
        violations.push({
          file,
          message: 'node carries a review/aggregateRating'
        })
      }
      if (types.includes('Offer')) {
        const hasPrice = node.price !== undefined && node.price !== null
        if (!hasPrice || !node.priceCurrency) {
          violations.push({
            file,
            message: 'Offer missing price or priceCurrency'
          })
        }
      }
    })
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
