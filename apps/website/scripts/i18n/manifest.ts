import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export interface TranslationManifest {
  version: 1
  entries: Record<string, Record<string, string>>
}

function isManifest(value: unknown): value is TranslationManifest {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { entries?: unknown }).entries === 'object' &&
    (value as { entries?: unknown }).entries !== null &&
    Object.values((value as TranslationManifest).entries).every(
      (locales) =>
        typeof locales === 'object' &&
        locales !== null &&
        Object.values(locales).every(
          (hash) => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash)
        )
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
