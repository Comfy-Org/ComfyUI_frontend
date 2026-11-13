import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

/**
 * Reads the fields of a definition a pack passed to `member`. Refuses anything
 * but a plain object of the named fields.
 */
export function definitionFields<TField extends string>(
  member: string,
  definition: unknown,
  fields: readonly TField[]
): Partial<Record<TField, unknown>> {
  if (!isPlainObject(definition)) {
    throw invalidArgument(member, 'a definition object', definition)
  }
  const known = new Set<string>(fields)
  const unknownField = Object.keys(definition).find(
    (field) => !known.has(field)
  )
  if (unknownField !== undefined) {
    throw invalidArgument(
      member,
      `a definition of ${fields.join(', ')} only`,
      unknownField
    )
  }
  const read: Partial<Record<TField, unknown>> = {}
  for (const field of fields) read[field] = definition[field]
  return read
}

export function requiredName(member: string, name: unknown): string {
  if (typeof name !== 'string' || !name) {
    throw invalidArgument(member, 'a name', name)
  }
  return name
}

export function requiredFlag(member: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw invalidArgument(member, 'true or false', value)
  }
  return value
}

export function optionalFlag(
  member: string,
  value: unknown
): boolean | undefined {
  return value === undefined ? value : requiredFlag(member, value)
}

export function requiredSize(member: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidArgument(member, 'a finite size of 0 or more', value)
  }
  return value
}
