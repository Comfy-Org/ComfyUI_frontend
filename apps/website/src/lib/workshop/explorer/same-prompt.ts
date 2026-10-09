import type { SamePromptSample, SamePromptType } from '@/data/compareSamePrompt'
import { SAME_PROMPT_TYPES } from '@/data/compareSamePrompt'

export type SamePromptFilter = SamePromptType | 'all'

function showsAny(sample: SamePromptSample, slugs: readonly string[]) {
  return slugs.some((slug) => slug in sample.images)
}

/** The prompt types with a sample for at least one compared model. */
export function samePromptTypes(
  samples: readonly SamePromptSample[],
  slugs: readonly string[]
): SamePromptType[] {
  return SAME_PROMPT_TYPES.filter((type) =>
    samples.some((sample) => sample.type === type && showsAny(sample, slugs))
  )
}

/** The prompts to lay out as rows: of the chosen type, with a sample to show. */
export function samePromptRows(
  samples: readonly SamePromptSample[],
  slugs: readonly string[],
  filter: SamePromptFilter
): SamePromptSample[] {
  return samples.filter(
    (sample) =>
      (filter === 'all' || sample.type === filter) && showsAny(sample, slugs)
  )
}
