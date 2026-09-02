import { ref } from 'vue'

export const RUN_OUTCOMES = [
  'success',
  'nsfw',
  'validation',
  'provider',
  'rateLimit'
] as const
export type RunOutcome = (typeof RUN_OUTCOMES)[number]

export const MODEL_STATES = ['none', 'policy', 'unavailable'] as const
export type ModelState = (typeof MODEL_STATES)[number]

const outcome = ref<RunOutcome>('success')
const modelState = ref<ModelState>('none')

// Shared across islands so the tweaks panel drives the playground.
export function usePrototypeTweaks() {
  return { outcome, modelState }
}
