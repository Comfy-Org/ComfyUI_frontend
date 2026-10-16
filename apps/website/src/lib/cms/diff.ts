import type { ContentCatalogRecord } from '@comfyorg/ingest-types'

export interface FieldChange {
  path: string
  action: 'added' | 'removed' | 'changed'
  before?: unknown
  after?: unknown
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function canonical(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value)
}

function identity(value: unknown): string | undefined {
  if (!object(value)) return undefined
  for (const key of ['uid', 'id', 'name']) {
    const id = value[key]
    if (typeof id === 'string' || typeof id === 'number')
      return `${key}:${JSON.stringify(id)}`
  }
  return undefined
}

function child(path: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`
}

function objectDiff(before: unknown, after: unknown, path: string) {
  if (
    (object(before) || before === undefined) &&
    (object(after) || after === undefined)
  ) {
    const left = object(before) ? before : {}
    const right = object(after) ? after : {}
    const keys = [
      ...new Set([...Object.keys(left), ...Object.keys(right)])
    ].sort()
    if (keys.length)
      return keys.flatMap((key) =>
        fieldDiff(left[key], right[key], child(path, key))
      )
  }
  return undefined
}

export function fieldDiff(
  before: unknown,
  after: unknown,
  path = '$'
): FieldChange[] {
  if (canonical(before) === canonical(after)) return []
  const nested = objectDiff(before, after, path)
  if (nested) return nested
  if (Array.isArray(before) && Array.isArray(after))
    return arrayDiff(before, after, path)
  return [
    {
      path,
      action:
        before === undefined
          ? 'added'
          : after === undefined
            ? 'removed'
            : 'changed',
      ...(before !== undefined ? { before } : {}),
      ...(after !== undefined ? { after } : {})
    }
  ]
}

function counts(ids: (string | undefined)[]) {
  const result = new Map<string, number>()
  for (const id of ids)
    if (id !== undefined) result.set(id, (result.get(id) ?? 0) + 1)
  return result
}

function arrayMatcher(
  before: unknown[],
  after: unknown[],
  leftIDs: (string | undefined)[],
  rightIDs: (string | undefined)[]
) {
  const left = before.map(canonical),
    right = after.map(canonical)
  const leftCounts = counts(leftIDs),
    rightCounts = counts(rightIDs)
  return (i: number, j: number) =>
    left[i] === right[j] ||
    (leftIDs[i] !== undefined &&
      leftIDs[i] === rightIDs[j] &&
      leftCounts.get(leftIDs[i]) === 1 &&
      rightCounts.get(leftIDs[i]) === 1)
}

function alignmentLengths(
  left: number,
  right: number,
  matches: (i: number, j: number) => boolean
) {
  const lengths = Array.from(
    { length: left + 1 },
    () => new Uint32Array(right + 1)
  )
  for (let i = left - 1; i >= 0; i--)
    for (let j = right - 1; j >= 0; j--)
      lengths[i][j] = matches(i, j)
        ? 1 + lengths[i + 1][j + 1]
        : Math.max(lengths[i + 1][j], lengths[i][j + 1])
  return lengths
}

function arrayAnchors(
  left: number,
  right: number,
  matches: (i: number, j: number) => boolean
) {
  const lengths = alignmentLengths(left, right, matches)
  const anchors: [number, number][] = []
  let i = 0,
    j = 0
  while (i < left && j < right) {
    if (matches(i, j)) anchors.push([i++, j++])
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++
    else j++
  }
  anchors.push([left, right])
  return anchors
}

function gapChanges(
  before: unknown[],
  after: unknown[],
  path: string,
  start: [number, number],
  end: [number, number],
  leftIDs: (string | undefined)[],
  rightIDs: (string | undefined)[]
) {
  let [i, j] = start
  const [endI, endJ] = end
  const changes: FieldChange[] = []
  while (i < endI && j < endJ && !leftIDs[i] && !rightIDs[j])
    changes.push(...fieldDiff(before[i++], after[j], `${path}[${j++}]`))
  while (i < endI)
    changes.push({
      path: `${path}[${i}]`,
      action: 'removed',
      before: before[i++]
    })
  while (j < endJ)
    changes.push({ path: `${path}[${j}]`, action: 'added', after: after[j++] })
  return changes
}

function arrayDiff(
  before: unknown[],
  after: unknown[],
  path: string
): FieldChange[] {
  if (before.length * after.length > 100_000)
    return Array.from(
      { length: Math.max(before.length, after.length) },
      (_, i) => fieldDiff(before[i], after[i], `${path}[${i}]`)
    ).flat()
  const leftIDs = before.map(identity),
    rightIDs = after.map(identity)
  const anchors = arrayAnchors(
    before.length,
    after.length,
    arrayMatcher(before, after, leftIDs, rightIDs)
  )
  const changes: FieldChange[] = []
  let start: [number, number] = [0, 0]
  for (const end of anchors) {
    changes.push(
      ...gapChanges(before, after, path, start, end, leftIDs, rightIDs)
    )
    const [i, j] = end
    if (i < before.length && j < after.length)
      changes.push(...fieldDiff(before[i], after[j], `${path}[${j}]`))
    start = [i + 1, j + 1]
  }
  return changes
}

function fields(record: ContentCatalogRecord | undefined) {
  if (!record || record.deleted) return undefined
  return {
    kind: record.kind,
    slug: record.slug,
    enabled: record.enabled,
    visibility: record.visibility,
    visible_from: record.visible_from,
    data: record.data
  }
}

export function contentDiff(
  before: ContentCatalogRecord | undefined,
  after: ContentCatalogRecord | undefined
) {
  return fieldDiff(fields(before), fields(after))
}
