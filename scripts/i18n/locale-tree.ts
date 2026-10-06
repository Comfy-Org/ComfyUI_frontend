import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export type LocaleLeaf = boolean | number | string | null
export type LocaleTrackedLeaf = LocaleLeaf | LocaleValue[]
export type LocaleValue = LocaleLeaf | LocaleObject | LocaleValue[]

export interface LocaleObject {
  [key: string]: LocaleValue
}

export interface LocaleChanges {
  added: string[]
  deleted: string[]
  modified: string[]
}

export interface LocaleLeafEntry {
  path: string[]
  value: LocaleTrackedLeaf
}

function isLocaleValue(value: unknown): value is LocaleValue {
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    value === null
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every(isLocaleValue)
  return isLocaleObject(value)
}

export function isLocaleObject(value: unknown): value is LocaleObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(isLocaleValue)
  )
}

export function parseLocale(content: string, filename: string): LocaleObject {
  const parsed: unknown = JSON.parse(content)
  if (!isLocaleObject(parsed)) {
    throw new Error(`${filename} has an unsupported locale value`)
  }
  return parsed
}

export function readLocale(filename: string): LocaleObject {
  return parseLocale(readFileSync(filename, 'utf8'), filename)
}

export function serializeLocale(locale: LocaleObject): string {
  return `${JSON.stringify(locale, null, 2)}\n`
}

export function pathKey(path: string[]): string {
  return JSON.stringify(path)
}

export function collectLeaves(
  value: LocaleObject,
  parent: string[] = [],
  leaves = new Map<string, LocaleLeafEntry>()
): Map<string, LocaleLeafEntry> {
  for (const [key, child] of Object.entries(value)) {
    const path = [...parent, key]
    if (Array.isArray(child) || typeof child !== 'object' || child === null) {
      leaves.set(pathKey(path), { path, value: child })
    } else {
      collectLeaves(child, path, leaves)
    }
  }
  return leaves
}

export function getLeaf(
  locale: LocaleObject,
  path: string[]
): LocaleTrackedLeaf | undefined {
  let value: LocaleValue | undefined = locale
  for (const segment of path) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.hasOwn(value, segment)
    ) {
      return undefined
    }
    value = value[segment]
  }
  return Array.isArray(value) || typeof value !== 'object' || value === null
    ? value
    : undefined
}

export function fingerprintLeaf(value: LocaleTrackedLeaf): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function fingerprintLocale(
  locale: LocaleObject
): Record<string, string> {
  return Object.fromEntries(
    [...collectLeaves(locale)].map(([key, leaf]) => [
      key,
      fingerprintLeaf(leaf.value)
    ])
  )
}

export function diffLocaleSources(
  previous: Readonly<Record<string, string>>,
  current: Readonly<Record<string, string>>
): LocaleChanges {
  const added: string[] = []
  const modified: string[] = []
  for (const [key, hash] of Object.entries(current)) {
    if (!Object.hasOwn(previous, key)) added.push(key)
    else if (previous[key] !== hash) modified.push(key)
  }
  return {
    added: added.sort(),
    deleted: Object.keys(previous)
      .filter((key) => !Object.hasOwn(current, key))
      .sort(),
    modified: modified.sort()
  }
}

function leafShapeMatches(
  source: LocaleValue,
  target: LocaleValue | undefined
): boolean {
  if (typeof source === 'string') return typeof target === 'string'
  if (Array.isArray(source)) {
    return (
      Array.isArray(target) &&
      target.length === source.length &&
      source.every((element, index) => leafShapeMatches(element, target[index]))
    )
  }
  return JSON.stringify(source) === JSON.stringify(target)
}

export function isTranslatableLeaf(value: LocaleTrackedLeaf): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) {
    return value.some(
      (element) =>
        (typeof element === 'string' && element.trim().length > 0) ||
        (Array.isArray(element) && isTranslatableLeaf(element))
    )
  }
  return false
}

export function collectPendingLeaves(
  source: LocaleObject,
  existing: LocaleObject,
  invalidated: ReadonlySet<string>,
  leafCorrupted?: (
    source: LocaleTrackedLeaf,
    target: LocaleTrackedLeaf
  ) => boolean
): LocaleLeafEntry[] {
  const pending: LocaleLeafEntry[] = []
  for (const [key, leaf] of collectLeaves(source)) {
    if (!isTranslatableLeaf(leaf.value)) continue
    const existingLeaf = getLeaf(existing, leaf.path)
    if (
      invalidated.has(key) ||
      !leafShapeMatches(leaf.value, existingLeaf) ||
      (existingLeaf !== undefined &&
        leafCorrupted !== undefined &&
        leafCorrupted(leaf.value, existingLeaf))
    ) {
      pending.push(leaf)
    }
  }
  return pending
}

export function rebuildLocale(
  source: LocaleObject,
  existing: LocaleObject,
  invalidated: ReadonlySet<string>,
  translations: ReadonlyMap<string, LocaleTrackedLeaf>,
  omitted: ReadonlySet<string> = new Set()
): LocaleObject {
  function rebuildObject(node: LocaleObject, parent: string[]): LocaleObject {
    // Object.fromEntries defines own data properties, so keys like __proto__
    // survive instead of invoking the prototype setter
    return Object.fromEntries(
      Object.keys(node)
        .sort()
        .flatMap<[string, LocaleValue]>((key) => {
          const child = node[key]
          const path = [...parent, key]
          if (omitted.has(pathKey(path))) return []
          if (child && typeof child === 'object' && !Array.isArray(child)) {
            const nested = rebuildObject(child, path)
            return Object.keys(nested).length || !Object.keys(child).length
              ? [[key, nested]]
              : []
          }
          return [[key, rebuildLeaf(child, path)]]
        })
    )
  }

  function rebuildLeaf(leaf: LocaleTrackedLeaf, path: string[]): LocaleValue {
    const key = pathKey(path)
    const translated = translations.get(key)
    if (translated !== undefined) return structuredClone(translated)
    if (!isTranslatableLeaf(leaf)) return structuredClone(leaf)
    const existingLeaf = getLeaf(existing, path)
    if (
      existingLeaf !== undefined &&
      !invalidated.has(key) &&
      leafShapeMatches(leaf, existingLeaf)
    ) {
      return structuredClone(existingLeaf)
    }
    throw new Error(`No translation available for ${path.join('.')}`)
  }

  return rebuildObject(source, [])
}
