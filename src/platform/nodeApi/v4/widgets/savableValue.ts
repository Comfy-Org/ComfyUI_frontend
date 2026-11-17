import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { WidgetValue } from '@/platform/nodeApi/v4/types'

const SAVABLE =
  'a string, a finite number, a boolean, null, or a plain object or array of those'

interface Unsavable {
  readonly path: string
  readonly value: unknown
}

/** A copy of `value` the workflow can save, or a `TypeError` naming `member` and the part of `field` it cannot save. */
export function savableValue(
  member: string,
  value: unknown,
  field = 'value'
): WidgetValue {
  assertSavable(member, value, field)
  return typeof value === 'object' ? structuredClone(value) : value
}

export function assertSavable(
  member: string,
  value: unknown,
  field: string
): asserts value is WidgetValue {
  const unsavable = firstUnsavable(value, field, new Set())
  if (unsavable) {
    throw invalidArgument(
      member,
      `${unsavable.path} as ${SAVABLE}`,
      unsavable.value
    )
  }
}

export function isSavable(value: unknown): value is WidgetValue {
  return firstUnsavable(value, '', new Set()) === undefined
}

function firstUnsavable(
  value: unknown,
  path: string,
  ancestors: Set<object>
): Unsavable | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return undefined
  if (typeof value === 'number') {
    return Number.isFinite(value) ? undefined : { path, value }
  }
  if (value === null) return undefined
  if (typeof value !== 'object' || ancestors.has(value)) return { path, value }
  if (!Array.isArray(value) && !isPlainObject(value)) return { path, value }
  ancestors.add(value)
  const found = firstUnsavableField(value, path, ancestors)
  ancestors.delete(value)
  return found
}

function firstUnsavableField(
  value: object,
  path: string,
  ancestors: Set<object>
): Unsavable | undefined {
  const fields = Object.entries(Object.getOwnPropertyDescriptors(value))
  for (const [key, field] of fields) {
    if (!field.enumerable) continue
    const fieldPath = Array.isArray(value)
      ? `${path}[${key}]`
      : `${path}.${key}`
    const found =
      'value' in field
        ? firstUnsavable(field.value, fieldPath, ancestors)
        : { path: fieldPath, value: field.get ?? field.set }
    if (found) return found
  }
  return undefined
}
