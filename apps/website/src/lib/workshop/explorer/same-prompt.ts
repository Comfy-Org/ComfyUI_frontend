import type { SamePromptSample, SamePromptType } from '@/data/compareSamePrompt'
import { SAME_PROMPT_TYPES } from '@/data/compareSamePrompt'

export type SamePromptFilter = SamePromptType | 'all'

/** A prompt is only a comparison when two of the models answered it. */
function compares(sample: SamePromptSample, slugs: readonly string[]) {
  return slugs.filter((slug) => slug in sample.images).length >= 2
}

/** Whether two models have answered at least one prompt in common. */
export function sharesSamples(
  samples: readonly SamePromptSample[],
  a: string,
  b: string
): boolean {
  return samples.some((sample) => compares(sample, [a, b]))
}

/** The prompt types with a prompt at least two compared models answered. */
export function samePromptTypes(
  samples: readonly SamePromptSample[],
  slugs: readonly string[]
): SamePromptType[] {
  return SAME_PROMPT_TYPES.filter((type) =>
    samples.some((sample) => sample.type === type && compares(sample, slugs))
  )
}

/** The prompts to lay out as rows: of the chosen type, answered by two or more. */
export function samePromptRows(
  samples: readonly SamePromptSample[],
  slugs: readonly string[],
  filter: SamePromptFilter
): SamePromptSample[] {
  return samples.filter(
    (sample) =>
      (filter === 'all' || sample.type === filter) && compares(sample, slugs)
  )
}
