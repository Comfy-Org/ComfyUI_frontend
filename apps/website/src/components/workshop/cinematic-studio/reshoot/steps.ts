import type { DepthState } from '@/composables/useReshoot'

export type StepState = 'done' | 'current' | 'next'
export type ReshootStepId = 'clip' | 'camera' | 'reshoot' | 'result'

const ORDER: readonly ReshootStepId[] = ['clip', 'camera', 'reshoot', 'result']

export function currentStep({
  depth,
  selected,
  aimed
}: {
  depth: DepthState
  selected: string
  aimed: boolean
}): ReshootStepId {
  if (depth !== 'ready') return 'clip'
  if (selected !== 'aim' && selected !== 'example') return 'result'
  return aimed ? 'reshoot' : 'camera'
}

export function stepState(
  step: ReshootStepId,
  current: ReshootStepId
): StepState {
  const at = ORDER.indexOf(step)
  const now = ORDER.indexOf(current)
  if (at < now) return 'done'
  return at === now ? 'current' : 'next'
}
