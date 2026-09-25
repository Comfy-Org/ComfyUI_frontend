import { readFileSync, renameSync, writeFileSync } from 'node:fs'

function serialize(snapshot: unknown): string {
  return JSON.stringify(snapshot, null, 2) + '\n'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function substantiveFields(serialized: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const rest = { ...parsed }
  delete rest.fetchedAt
  return JSON.stringify(rest)
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
 * captured" and keeps scheduled runs silent unless a role or node actually
 * changed.
 *
 * Returns whether the file was written.
 */
export function writeSnapshotIfChanged(
  snapshotPath: string,
  snapshot: { fetchedAt: string }
): boolean {
  const next = serialize(snapshot)
  const current = readIfPresent(snapshotPath)

  if (current !== null) {
    const currentFields = substantiveFields(current)
    if (currentFields !== null && currentFields === substantiveFields(next)) {
      return false
    }
  }

  const tempPath = `${snapshotPath}.tmp`
  writeFileSync(tempPath, next, 'utf8')
  renameSync(tempPath, snapshotPath)
  return true
}
