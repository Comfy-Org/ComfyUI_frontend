import type { TranslationPipelineConfig } from './config'
import type {
  LocaleLeafEntry,
  LocaleObject,
  LocaleTrackedLeaf
} from './locale-tree'
import { getLeaf, pathKey } from './locale-tree'

export function partitionLocale({
  sourceLeaves,
  previousEnglish,
  existing,
  publishedLocale,
  modifiedKeys,
  policy,
  excludedKeys,
  previousReviewNeeded
}: {
  sourceLeaves: ReadonlyMap<string, LocaleLeafEntry>
  previousEnglish: LocaleObject
  existing: LocaleObject
  publishedLocale: LocaleObject
  modifiedKeys: ReadonlySet<string>
  policy: TranslationPipelineConfig['existingCopy']
  excludedKeys: ReadonlySet<string>
  previousReviewNeeded: readonly string[][]
}): {
  omitted: Set<string>
  retained: Map<string, LocaleTrackedLeaf>
  reviewNeeded: string[][]
} {
  const omitted = new Set<string>()
  const retained = new Map<string, LocaleTrackedLeaf>()
  const reviewNeeded: string[][] = []
  if (policy.kind === 'regenerate') return { omitted, retained, reviewNeeded }
  const previousReview = new Set(previousReviewNeeded.map(pathKey))
  for (const [key, leaf] of sourceLeaves) {
    const excluded = excludedKeys.has(key)
    const current = getLeaf(existing, leaf.path)
    const edited =
      JSON.stringify(current) !==
      JSON.stringify(getLeaf(publishedLocale, leaf.path))
    if (excluded) {
      const previous = getLeaf(previousEnglish, leaf.path)
      if (
        current === undefined ||
        (current !== '' && (current === leaf.value || current === previous))
      ) {
        omitted.add(key)
        continue
      }
      retained.set(key, current)
    } else if (current !== undefined && (!modifiedKeys.has(key) || edited)) {
      retained.set(key, current)
    }
    if (
      retained.has(key) &&
      (modifiedKeys.has(key) || (previousReview.has(key) && !edited))
    )
      reviewNeeded.push(leaf.path)
  }
  return { omitted, retained, reviewNeeded }
}
