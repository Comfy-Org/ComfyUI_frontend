export function pointerKeys(path: string): string[] {
  if (path === '') return []
  if (!path.startsWith('/') || /~(?:[^01]|$)/.test(path))
    throw new Error('Invalid JSON pointer')
  const keys = path
    .slice(1)
    .split('/')
    .map((key) => key.replaceAll('~1', '/').replaceAll('~0', '~'))
  if (
    keys.length > 64 ||
    keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))
  )
    throw new Error('Unsafe JSON pointer')
  return keys
}

export function valuesAtPointer(value: unknown, path: string): unknown[] {
  return pointerKeys(path).reduce<unknown[]>(
    (values, key) =>
      values.flatMap((item) => {
        if (item === null || typeof item !== 'object') return []
        if (key === '*') return Object.values(item)
        return Object.hasOwn(item, key) ? [Reflect.get(item, key)] : []
      }),
    [value]
  )
}

function isContainer(
  value: unknown
): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object'
}

export function setAtPointer(
  root: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = pointerKeys(path)
  if (!keys.length || keys.includes('*'))
    throw new Error('Invalid writable pointer')
  let parent: Record<string, unknown> | unknown[] = root
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    if (
      Array.isArray(parent) &&
      (!/^(0|[1-9]\d*)$/.test(key) || Number(key) > parent.length)
    )
      throw new Error('Sparse media array')
    if (index === keys.length - 1) {
      if (
        Object.hasOwn(parent, key) &&
        Reflect.get(parent, key) !== undefined &&
        Reflect.get(parent, key) !== ''
      )
        throw new Error('Conflicting media input')
      Reflect.set(parent, key, value)
      return
    }
    const previous: unknown = Object.hasOwn(parent, key)
      ? Reflect.get(parent, key)
      : undefined
    if (previous !== undefined && !isContainer(previous))
      throw new Error('Invalid media input container')
    const child = previous ?? (/^(0|[1-9]\d*)$/.test(keys[index + 1]) ? [] : {})
    Reflect.set(parent, key, child)
    parent = child
  }
}
