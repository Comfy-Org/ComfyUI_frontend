import { readFileSync, renameSync, writeFileSync } from 'node:fs'

function serialize(snapshot: unknown): string {
  return JSON.stringify(snapshot, null, 2) + '\n'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function withoutKeys(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => withoutKeys(item, keys))
  if (!isRecord(value)) return value

  const kept: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key)) continue
    kept[key] = withoutKeys(item, keys)
  }
  return kept
}

function substantiveFields(
  serialized: string,
  ignored: ReadonlySet<string>
): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  return JSON.stringify(withoutKeys(parsed, ignored))
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * Every refresh stamps a new `fetchedAt`, so writing unconditionally makes the
 * file differ from HEAD on every run — which, on a schedule, means a pull
 * request whose entire diff is a timestamp. Leaving the file untouched when
 * only the timestamp moved keeps `fetchedAt` meaning "when this content was
 * captured", and keeps scheduled runs silent unless the data actually changed.
 *
 * `volatileKeys` names fields that drift on their own — download and star
 * counters, say — which would otherwise defeat that just as thoroughly as the
 * timestamp. They are stripped at any depth for the comparison only: once
 * something substantive changes, the values written are the freshly fetched
 * ones. The counters are therefore as old as the last real change, which is
 * what a fallback snapshot warrants; production reads them live.
 *
 * Returns whether the file was written.
 */
export function writeSnapshotIfChanged(
  snapshotPath: string,
  snapshot: { fetchedAt: string },
  volatileKeys: readonly string[] = []
): boolean {
  const ignored = new Set(['fetchedAt', ...volatileKeys])
  const next = serialize(snapshot)
  const current = readIfPresent(snapshotPath)

  if (current !== null) {
    const currentFields = substantiveFields(current, ignored)
    if (
      currentFields !== null &&
      currentFields === substantiveFields(next, ignored)
    ) {
      return false
    }
  }

  const tempPath = `${snapshotPath}.tmp`
  writeFileSync(tempPath, next, 'utf8')
  renameSync(tempPath, snapshotPath)
  return true
}
