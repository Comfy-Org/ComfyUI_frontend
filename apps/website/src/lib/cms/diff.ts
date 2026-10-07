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

export function fieldDiff(
  before: unknown,
  after: unknown,
  path = '$'
): FieldChange[] {
  if (canonical(before) === canonical(after)) return []
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

function arrayDiff(
  before: unknown[],
  after: unknown[],
  path: string
): FieldChange[] {
  const left = before.map(canonical)
  const right = after.map(canonical)
  const leftIDs = before.map(identity)
  const rightIDs = after.map(identity)
  const counts = (ids: (string | undefined)[]) => {
    const result = new Map<string, number>()
    for (const id of ids)
      if (id !== undefined) result.set(id, (result.get(id) ?? 0) + 1)
    return result
  }
  const leftCounts = counts(leftIDs),
    rightCounts = counts(rightIDs)
  const matches = (i: number, j: number) =>
    left[i] === right[j] ||
    (leftIDs[i] !== undefined &&
      leftIDs[i] === rightIDs[j] &&
      leftCounts.get(leftIDs[i]) === 1 &&
      rightCounts.get(leftIDs[i]) === 1)
  if (before.length * after.length > 100_000) {
    return Array.from(
      { length: Math.max(before.length, after.length) },
      (_, i) => fieldDiff(before[i], after[i], `${path}[${i}]`)
    ).flat()
  }
  const lengths = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1)
  )
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      lengths[i][j] = matches(i, j)
        ? 1 + lengths[i + 1][j + 1]
        : Math.max(lengths[i + 1][j], lengths[i][j + 1])
  const anchors: [number, number][] = []
  let i = 0,
    j = 0
  while (i < before.length && j < after.length) {
    if (matches(i, j)) {
      anchors.push([i++, j++])
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++
    else j++
  }
  anchors.push([before.length, after.length])
  const changes: FieldChange[] = []
  i = 0
  j = 0
  for (const [endI, endJ] of anchors) {
    while (i < endI && j < endJ && !leftIDs[i] && !rightIDs[j]) {
      changes.push(...fieldDiff(before[i++], after[j], `${path}[${j++}]`))
    }
    while (i < endI)
      changes.push({
        path: `${path}[${i}]`,
        action: 'removed',
        before: before[i++]
      })
    while (j < endJ)
      changes.push({
        path: `${path}[${j}]`,
        action: 'added',
        after: after[j++]
      })
    if (endI < before.length && endJ < after.length)
      changes.push(...fieldDiff(before[endI], after[endJ], `${path}[${endJ}]`))
    i = endI + 1
    j = endJ + 1
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

export function displayValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
