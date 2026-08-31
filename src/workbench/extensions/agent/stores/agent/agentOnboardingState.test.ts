import { describe, expect, it } from 'vitest'

import {
  initialAgentOnboardingState,
  reduceAgentOnboardingState
} from './agentOnboardingState'

describe('agentOnboardingState', () => {
  it('accepts practice nodes only in the guided order', () => {
    const practice = reduceAgentOnboardingState(initialAgentOnboardingState, {
      type: 'start'
    })
    const ignored = reduceAgentOnboardingState(practice, {
      type: 'add-node',
      node: 'output'
    })
    const prompt = reduceAgentOnboardingState(ignored, {
      type: 'add-node',
      node: 'prompt'
    })
    const duplicate = reduceAgentOnboardingState(prompt, {
      type: 'add-node',
      node: 'prompt'
    })

    expect(ignored).toEqual(practice)
    expect(duplicate).toEqual(prompt)
  })

  it('finishes only after the complete input-process-output sequence', () => {
    let state = reduceAgentOnboardingState(initialAgentOnboardingState, {
      type: 'start'
    })
    state = reduceAgentOnboardingState(state, {
      type: 'add-node',
      node: 'prompt'
    })
    expect(reduceAgentOnboardingState(state, { type: 'finish' })).toEqual(state)

    state = reduceAgentOnboardingState(state, {
      type: 'add-node',
      node: 'generate'
    })
    state = reduceAgentOnboardingState(state, {
      type: 'add-node',
      node: 'output'
    })
    state = reduceAgentOnboardingState(state, { type: 'finish' })

    expect(state).toEqual({ phase: 'complete' })
    expect(reduceAgentOnboardingState(state, { type: 'restart' })).toEqual(
      initialAgentOnboardingState
    )
  })
})
