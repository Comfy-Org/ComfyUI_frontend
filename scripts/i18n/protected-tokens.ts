import type { LocaleChanges, LocaleObject, LocaleValue } from './locale-tree'
import { collectLeaves, getLeaf, pathKey } from './locale-tree'

const quoteCharacters = `['"“”‘’«»‹›„‚「」『』]`
const htmlTagPattern = /<\/?[a-z][^>]*>/g
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

function matches(
  value: string,
  pattern: RegExp,
  preserveCounts: boolean
): string[] {
  const found = value.match(pattern) ?? []
  return preserveCounts ? found : [...new Set(found)]
}

function unmatched(expected: string[], actual: string[]): string[] {
  const remaining = [...actual]
  return expected.filter((token) => {
    const index = remaining.indexOf(token)
    if (index === -1) return true
    remaining.splice(index, 1)
    return false
  })
}

export function protectedTokens(
  value: string,
  includeInterpolation: boolean,
  strict: boolean = false
): string[] {
  const patterns = strict
    ? [...protectedLiteralPatterns, htmlTagPattern]
    : protectedLiteralPatterns
  const tokens = patterns.flatMap((pattern) => matches(value, pattern, strict))
  if (includeInterpolation) {
    tokens.push(...matches(value, interpolationPattern, strict))
  }
  return (strict ? tokens : [...new Set(tokens)]).sort()
}

export function tokenErrors(
  source: string,
  target: string,
  includeInterpolation: boolean,
  strict: boolean = false
): string[] {
  const sourceTokens = protectedTokens(source, includeInterpolation, strict)
  const targetTokens = protectedTokens(target, includeInterpolation, strict)
  const missing = unmatched(sourceTokens, targetTokens)
  const added = unmatched(targetTokens, sourceTokens)
  const htmlSequenceChanged =
    strict &&
    JSON.stringify(matches(source, htmlTagPattern, true)) !==
      JSON.stringify(matches(target, htmlTagPattern, true))
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
      : []),
    ...(htmlSequenceChanged ? ['changed HTML tag sequence'] : [])
  ]
}

function leafTokenErrors(
  source: LocaleValue,
  target: LocaleValue | undefined,
  label: string,
  strict: boolean
): string[] {
  if (typeof source === 'string') {
    return typeof target === 'string'
      ? tokenErrors(source, target, true, strict).map(
          (error) => `${label}: ${error}`
        )
      : [`${label}: leaf type changed`]
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(target)) return [`${label}: leaf type changed`]
    if (source.length !== target.length)
      return [`${label}: array length changed`]
    return source.flatMap((element, index) =>
      leafTokenErrors(element, target[index], `${label}.${index}`, strict)
    )
  }
  return JSON.stringify(source) === JSON.stringify(target)
    ? []
    : [`${label}: leaf value changed`]
}

export function leafTokensDiffer(
  source: LocaleValue,
  target: LocaleValue | undefined,
  strict: boolean = false
): boolean {
  return leafTokenErrors(source, target, 'leaf', strict).length > 0
}

export function validateLocale(
  source: LocaleObject,
  locale: LocaleObject,
  changes: LocaleChanges,
  strict: boolean = false
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
    errors.push(...leafTokenErrors(sourceValue, targetValue, label, strict))
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

  errors.push(
    ...auditProtectedLiterals(source, locale, regeneratedKeys, strict)
  )

  return errors
}

export function auditProtectedLiterals(
  source: LocaleObject,
  target: LocaleObject,
  skipKeys: ReadonlySet<string>,
  strict: boolean = false,
  knownViolations: ReadonlySet<string> = new Set()
): string[] {
  const targetLeaves = collectLeaves(target)
  return [...collectLeaves(source)].flatMap(([key, leaf]) => {
    if (skipKeys.has(key)) return []
    const targetLeaf = targetLeaves.get(key)
    if (targetLeaf === undefined) return []
    return leafTokenErrors(
      leaf.value,
      targetLeaf.value,
      leaf.path.join('.'),
      strict
    ).filter((error) => !knownViolations.has(error))
  })
}
