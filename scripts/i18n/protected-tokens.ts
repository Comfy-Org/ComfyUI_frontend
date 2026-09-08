import type { LocaleChanges, LocaleObject, LocaleValue } from './locale-tree'
import { collectLeaves, getLeaf, pathKey } from './locale-tree'

const quoteCharacters = `['"“”‘’«»‹›„‚「」『』]`
const protectedLiteralPatterns = [
  /<(?:Picture|Video|Audio) [A-Za-z0-9]+>/g,
  /\b\d+k\+\d+\b/g,
  new RegExp(`(?<=${quoteCharacters})(?:match|max)(?=${quoteCharacters})`, 'g')
]
// Named ({name}), positional list ({0}), and literal ({'@'}) interpolation
const interpolationPattern = /\{(?:[A-Za-z][A-Za-z0-9_.-]*|\d+|'[^']*')\}/g
// vue-i18n message syntax the model must not introduce: | separates plural
// forms, @:key / @.modifier:key are linked messages
const pluralSeparatorPattern = /\|/
const linkedMessagePattern = /@[.:]/

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set(value.match(pattern) ?? [])].sort()
}

export function protectedTokens(
  value: string,
  includeInterpolation: boolean
): string[] {
  const tokens = protectedLiteralPatterns.flatMap((pattern) =>
    uniqueMatches(value, pattern)
  )
  if (includeInterpolation) {
    tokens.push(...uniqueMatches(value, interpolationPattern))
  }
  return [...new Set(tokens)].sort()
}

export function tokenErrors(
  source: string,
  target: string,
  includeInterpolation: boolean
): string[] {
  const sourceTokens = protectedTokens(source, includeInterpolation)
  const targetTokens = protectedTokens(target, includeInterpolation)
  const missing = sourceTokens.filter((token) => !targetTokens.includes(token))
  const added = targetTokens.filter((token) => !sourceTokens.includes(token))
  return [
    ...(missing.length ? [`missing ${missing.join(', ')}`] : []),
    ...(added.length ? [`added ${added.join(', ')}`] : []),
    ...(source.trim().length > 0 && target.trim().length === 0
      ? ['empty translation']
      : []),
    ...(pluralSeparatorPattern.test(target) &&
    !pluralSeparatorPattern.test(source)
      ? ['added plural separator |']
      : []),
    ...(linkedMessagePattern.test(target) && !linkedMessagePattern.test(source)
      ? ['added linked message @']
      : [])
  ]
}

function leafTokenErrors(
  source: LocaleValue,
  target: LocaleValue | undefined,
  label: string
): string[] {
  if (typeof source === 'string') {
    return typeof target === 'string'
      ? tokenErrors(source, target, true).map((error) => `${label}: ${error}`)
      : [`${label}: leaf type changed`]
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(target)) return [`${label}: leaf type changed`]
    if (source.length !== target.length)
      return [`${label}: array length changed`]
    return source.flatMap((element, index) =>
      leafTokenErrors(element, target[index], `${label}.${index}`)
    )
  }
  return JSON.stringify(source) === JSON.stringify(target)
    ? []
    : [`${label}: leaf value changed`]
}

export function leafTokensDiffer(
  source: LocaleValue,
  target: LocaleValue | undefined
): boolean {
  return leafTokenErrors(source, target, 'leaf').length > 0
}

export function validateLocale(
  source: LocaleObject,
  locale: LocaleObject,
  changes: LocaleChanges
): string[] {
  const errors: string[] = []
  const sourceLeaves = collectLeaves(source)
  const regeneratedKeys = new Set(
    [...changes.added, ...changes.modified].map(pathKey)
  )

  for (const path of [...changes.added, ...changes.modified]) {
    const sourceValue = getLeaf(source, path)
    const targetValue = getLeaf(locale, path)
    const label = path.join('.')
    if (sourceValue === undefined) continue
    if (targetValue === undefined) {
      errors.push(`${label}: translation was not regenerated`)
      continue
    }
    errors.push(...leafTokenErrors(sourceValue, targetValue, label))
  }

  for (const path of changes.deleted) {
    if (getLeaf(locale, path) !== undefined) {
      errors.push(`${path.join('.')}: deleted source key remains`)
    }
  }

  for (const [key, leaf] of collectLeaves(locale)) {
    if (!sourceLeaves.has(key)) {
      errors.push(`${leaf.path.join('.')}: key does not exist in the source`)
    }
  }

  errors.push(...auditProtectedLiterals(source, locale, regeneratedKeys))

  return errors
}

export function auditProtectedLiterals(
  source: LocaleObject,
  target: LocaleObject,
  skipKeys: ReadonlySet<string>
): string[] {
  const targetLeaves = collectLeaves(target)
  return [...collectLeaves(source)].flatMap(([key, leaf]) => {
    if (skipKeys.has(key)) return []
    const targetLeaf = targetLeaves.get(key)
    if (targetLeaf === undefined) return []
    return leafTokenErrors(leaf.value, targetLeaf.value, leaf.path.join('.'))
  })
}
