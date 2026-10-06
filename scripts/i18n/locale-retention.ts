import type { TranslationPipelineConfig } from './config'
import type {
  LocaleLeafEntry,
  LocaleObject,
  LocaleTrackedLeaf
} from './locale-tree'
import { fingerprintLeaf, getLeaf, pathKey } from './locale-tree'

function usesEnglishFallback({
  current,
  source,
  previous
}: {
  current: LocaleTrackedLeaf | undefined
  source: LocaleTrackedLeaf
  previous: string | undefined
}): boolean {
  return (
    current === undefined ||
    (current !== '' &&
      !Array.isArray(current) &&
      (current === source || fingerprintLeaf(current) === previous))
  )
}

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
  previousEnglish: Readonly<Record<string, string>>
  existing: LocaleObject
  publishedLocale: Readonly<Record<string, string>>
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
    if (
      excluded &&
      usesEnglishFallback({
        current,
        source: leaf.value,
        previous: previousEnglish[key]
      })
    ) {
      omitted.add(key)
      continue
    }
    if (current === undefined) continue
    const edited = fingerprintLeaf(current) !== publishedLocale[key]
    if (!excluded && modifiedKeys.has(key) && !edited) continue
    retained.set(key, current)
    if (modifiedKeys.has(key) || (previousReview.has(key) && !edited))
      reviewNeeded.push(leaf.path)
  }
  return { omitted, retained, reviewNeeded }
}
