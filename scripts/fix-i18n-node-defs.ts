import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const LOCALES_DIR = 'src/locales'

/**
 * Convert arrays with numeric indices back to objects.
 * GPT-4.1 (used by @lobehub/i18n-cli) sometimes converts
 * {"0": {...}, "1": {...}} objects into JSON arrays with null gaps.
 */
function fixArraysToObjects(value: unknown): Record<string, unknown> | unknown {
  if (!value || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    const obj: Record<string, unknown> = {}
    for (let i = 0; i < value.length; i++) {
      if (value[i] != null) {
        obj[String(i)] = fixArraysToObjects(value[i])
      }
    }
    return obj
  }

  const record = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(record)) {
    result[key] = fixArraysToObjects(record[key])
  }
  return result
}

function run() {
  const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'en')
    .map((d) => d.name)

  let totalFixes = 0

  for (const locale of locales) {
    const filePath = join(LOCALES_DIR, locale, 'nodeDefs.json')
    let raw: string
    try {
      raw = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const data = JSON.parse(raw)
    const fixed = fixArraysToObjects(data) as Record<string, unknown>
    const fixedJson = JSON.stringify(fixed, null, 2) + '\n'

    if (fixedJson !== raw) {
      writeFileSync(filePath, fixedJson)
      totalFixes++
      console.warn(`Fixed: ${filePath}`)
    }
  }

  if (totalFixes === 0) {
    console.warn('No fixes needed')
  } else {
    console.warn(`Fixed ${totalFixes} file(s)`)
  }
}

run()
