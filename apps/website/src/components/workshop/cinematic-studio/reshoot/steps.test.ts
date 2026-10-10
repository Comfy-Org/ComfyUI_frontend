import { describe, expect, it } from 'vitest'

import type { DepthState } from '@/composables/useReshoot'
import type { ReshootStepId } from './steps'
import { currentStep, stepState } from './steps'

describe('currentStep', () => {
  it.for<{
    depth: DepthState
    selected: string
    aimed: boolean
    step: ReshootStepId
  }>([
    { depth: 'analyzing', selected: 'example', aimed: false, step: 'clip' },
    { depth: 'failed', selected: 'aim', aimed: true, step: 'clip' },
    { depth: 'ready', selected: 'example', aimed: false, step: 'camera' },
    { depth: 'ready', selected: 'aim', aimed: true, step: 'reshoot' },
    { depth: 'ready', selected: 'take-1', aimed: true, step: 'result' }
  ])(
    'is $step with depth $depth on $selected, aimed $aimed',
    ({ depth, selected, aimed, step }) => {
      expect(currentStep({ depth, selected, aimed })).toBe(step)
    }
  )
})

describe('stepState', () => {
  it.for<{ step: ReshootStepId; state: string }>([
    { step: 'clip', state: 'done' },
    { step: 'camera', state: 'current' },
    { step: 'reshoot', state: 'next' }
  ])('marks $step $state while the camera is aimed', ({ step, state }) => {
    expect(stepState(step, 'camera')).toBe(state)
  })
})
