import { isEqual } from 'es-toolkit'

import type { TranslationPipelineConfig } from './config'
import type {
  LocaleLeafEntry,
  LocaleObject,
  LocaleTrackedLeaf
} from './locale-tree'
import { getLeaf } from './locale-tree'
import { countPluralForms } from './protected-tokens'

function usesEnglishFallback({
  current,
  source,
  previous
}: {
  current: LocaleTrackedLeaf | undefined
  source: LocaleTrackedLeaf
  previous: LocaleTrackedLeaf | undefined
}): boolean {
  return (
    current === undefined ||
    (current !== '' &&
      [source, previous].some((value) => isEqual(value, current)))
  )
}

function hasLocalePluralForms(
  source: LocaleTrackedLeaf,
  current: LocaleTrackedLeaf | undefined,
  pluralFormCount: number
): current is string {
  return (
    typeof source === 'string' &&
    typeof current === 'string' &&
    countPluralForms(source) > 1 &&
    countPluralForms(source) !== pluralFormCount &&
    countPluralForms(current) === pluralFormCount
  )
}

export type LeafCorrupted = (
  source: LocaleTrackedLeaf,
  target: LocaleTrackedLeaf
) => boolean

function retainLocalePluralForms(
  sourceLeaves: ReadonlyMap<string, LocaleLeafEntry>,
  existing: LocaleObject,
  modifiedKeys: ReadonlySet<string>,
  pluralFormCount: number | undefined,
  leafCorrupted: LeafCorrupted
): Map<string, LocaleTrackedLeaf> {
  const retained = new Map<string, LocaleTrackedLeaf>()
  if (pluralFormCount === undefined) return retained
  for (const [key, leaf] of sourceLeaves) {
    const current = getLeaf(existing, leaf.path)
    if (
      !modifiedKeys.has(key) &&
      hasLocalePluralForms(leaf.value, current, pluralFormCount) &&
      !leafCorrupted(leaf.value, current)
    )
      retained.set(key, current)
  }
  return retained
}

export function partitionLocale({
  sourceLeaves,
  previousEnglish,
  existing,
  modifiedKeys,
  policy,
  excludedKeys,
  pluralFormCount,
  leafCorrupted = () => false
}: {
  sourceLeaves: ReadonlyMap<string, LocaleLeafEntry>
  previousEnglish: LocaleObject
  existing: LocaleObject
  modifiedKeys: ReadonlySet<string>
  policy: TranslationPipelineConfig['existingCopy']
  excludedKeys: ReadonlySet<string>
  pluralFormCount?: number
  leafCorrupted?: LeafCorrupted
}): {
  omitted: Set<string>
  retained: Map<string, LocaleTrackedLeaf>
} {
  const omitted = new Set<string>()
  const retained = new Map<string, LocaleTrackedLeaf>()
  if (policy.kind === 'regenerate')
    return {
      omitted,
      retained: retainLocalePluralForms(
        sourceLeaves,
        existing,
        modifiedKeys,
        pluralFormCount,
        leafCorrupted
      )
    }
  for (const [key, leaf] of sourceLeaves) {
    const excluded = excludedKeys.has(key)
    const current = getLeaf(existing, leaf.path)
    if (
      excluded &&
      usesEnglishFallback({
        current,
        source: leaf.value,
        previous: getLeaf(previousEnglish, leaf.path)
      })
    ) {
      omitted.add(key)
      continue
    }
    if (current === undefined) continue
    if (!excluded && modifiedKeys.has(key)) continue
    retained.set(key, current)
  }
  return { omitted, retained }
}
