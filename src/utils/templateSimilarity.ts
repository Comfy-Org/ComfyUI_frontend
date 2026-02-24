import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

import { intersection, union } from 'es-toolkit'

/**
 * Minimal metadata fields used by the similarity scorer.
 * Both EnhancedTemplate and MarketplaceTemplate can satisfy this
 * interface directly or via {@link toSimilarityInput}.
 */
export interface TemplateSimilarityInput {
  readonly name: string
  readonly categories?: readonly string[]
  readonly tags?: readonly string[]
  readonly models?: readonly string[]
  readonly requiredNodes?: readonly string[]
}

/**
 * A candidate template paired with its similarity score.
 */
export interface SimilarTemplate<T extends TemplateSimilarityInput> {
  readonly template: T
  readonly score: number
}

/** Per-dimension weights for the similarity formula. */
const SIMILARITY_WEIGHTS = {
  categories: 0.35,
  tags: 0.25,
  models: 0.3,
  requiredNodes: 0.1
} as const

/**
 * Compute Jaccard similarity between two string arrays.
 * Returns 0 when both arrays are empty (no evidence of similarity).
 */
function jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
  const u = union([...a], [...b])
  if (u.length === 0) return 0
  return intersection([...a], [...b]).length / u.length
}

/**
 * Score the similarity between two templates based on shared metadata.
 * Returns a value in [0, 1] where 1 is identical and 0 is no overlap.
 */
export function computeSimilarity(
  reference: TemplateSimilarityInput,
  candidate: TemplateSimilarityInput
): number {
  return (
    SIMILARITY_WEIGHTS.categories *
      jaccardSimilarity(
        reference.categories ?? [],
        candidate.categories ?? []
      ) +
    SIMILARITY_WEIGHTS.tags *
      jaccardSimilarity(reference.tags ?? [], candidate.tags ?? []) +
    SIMILARITY_WEIGHTS.models *
      jaccardSimilarity(reference.models ?? [], candidate.models ?? []) +
    SIMILARITY_WEIGHTS.requiredNodes *
      jaccardSimilarity(
        reference.requiredNodes ?? [],
        candidate.requiredNodes ?? []
      )
  )
}

/**
 * Find templates similar to a reference, sorted by descending similarity.
 * Excludes the reference template itself (matched by name) and any
 * candidates with zero similarity.
 *
 * @param reference - The template to find similar templates for
 * @param candidates - The pool of templates to score against
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Sorted array of similar templates with their scores
 */
export function findSimilarTemplates<T extends TemplateSimilarityInput>(
  reference: TemplateSimilarityInput,
  candidates: readonly T[],
  limit: number = 10
): SimilarTemplate<T>[] {
  return candidates
    .filter((c) => c.name !== reference.name)
    .map((candidate) => ({
      template: candidate,
      score: computeSimilarity(reference, candidate)
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Normalize an EnhancedTemplate (or TemplateInfo with category) to
 * the shape expected by the similarity scorer.
 *
 * Wraps the single `category` string into an array and maps
 * `requiresCustomNodes` to `requiredNodes`.
 */
export function toSimilarityInput(
  template: TemplateInfo & { category?: string }
): TemplateSimilarityInput {
  return {
    name: template.name,
    categories: template.category ? [template.category] : [],
    tags: template.tags ?? [],
    models: template.models ?? [],
    requiredNodes: template.requiresCustomNodes ?? []
  }
}
