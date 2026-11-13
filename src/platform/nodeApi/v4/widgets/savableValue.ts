import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { WidgetValue } from '@/platform/nodeApi/v4/types'

const SAVABLE =
  'a string, a finite number, a boolean, null, or a plain object or array of those'

/** A copy of `value` the workflow can save, or a `TypeError` naming `member`. */
export function savableValue(member: string, value: unknown): WidgetValue {
  assertSavable(member, value)
  return typeof value === 'object' ? structuredClone(value) : value
}

export function assertSavable(
  member: string,
  value: unknown
): asserts value is WidgetValue {
  if (!isSavable(value, new Set())) {
    throw invalidArgument(member, SAVABLE, value)
  }
}

function isSavable(
  value: unknown,
  ancestors: Set<object>
): value is WidgetValue {
  if (typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  return value === null || isSavableObject(value, ancestors)
}

function isSavableObject(value: object, ancestors: Set<object>): boolean {
  if (ancestors.has(value)) return false
  if (!Array.isArray(value) && !isPlainObject(value)) return false
  ancestors.add(value)
  const savable = Object.values(value).every((child) =>
    isSavable(child, ancestors)
  )
  ancestors.delete(value)
  return savable
}
