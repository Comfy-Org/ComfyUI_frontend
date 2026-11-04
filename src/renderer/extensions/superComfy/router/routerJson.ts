import type {
  JsonObject,
  JsonValue
} from '@/renderer/extensions/superComfy/router/routerTypes'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function step(value: unknown, key: string | number): unknown {
  if (typeof key === 'number') {
    return Array.isArray(value) ? value.at(key) : undefined
  }
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined
}

export function valueAt(
  root: unknown,
  path: readonly (string | number)[]
): unknown {
  return path.reduce<unknown>(step, root)
}

export function stringAt(
  root: unknown,
  path: readonly (string | number)[]
): string | undefined {
  const value = valueAt(root, path)
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function arrayAt(
  root: unknown,
  path: readonly (string | number)[]
): unknown[] {
  const value = valueAt(root, path)
  return Array.isArray(value) ? value : []
}

export function withoutUndefined(
  record: Record<string, JsonValue | undefined>
): JsonObject {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value]]
    )
  )
}

export function setAt(
  target: JsonObject,
  path: readonly string[],
  value: JsonValue
): JsonObject {
  if (path.length === 0) return target
  const [head, ...rest] = path
  if (rest.length === 0) return { ...target, [head]: value }
  const child = Object.hasOwn(target, head) ? target[head] : undefined
  return {
    ...target,
    [head]: setAt(isJsonObject(child) ? child : {}, rest, value)
  }
}
