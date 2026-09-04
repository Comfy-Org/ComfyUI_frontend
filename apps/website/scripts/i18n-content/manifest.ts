import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export interface TranslationManifest {
  version: 1
  entries: Record<string, Record<string, string>>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isManifest(value: unknown): value is TranslationManifest {
  if (!isPlainRecord(value) || value.version !== 1) return false
  if (!isPlainRecord(value.entries)) return false
  return Object.values(value.entries).every(
    (locales) =>
      isPlainRecord(locales) &&
      Object.values(locales).every(
        (hash) => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash)
      )
  )
}

export function loadManifest(path: string): TranslationManifest {
  if (!existsSync(path)) return { version: 1, entries: {} }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isManifest(parsed)) throw new Error(`${path} is not a valid manifest`)
  return parsed
}

export function saveManifest(
  path: string,
  manifest: TranslationManifest
): void {
  const entries = Object.fromEntries(
    Object.keys(manifest.entries)
      .sort()
      .map((key) => [key, manifest.entries[key]])
  )
  writeFileSync(path, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`)
}

export function hashSource(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
