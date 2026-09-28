import { describe, expect, it } from 'vitest'

import type { WorkflowCreditsGate } from './workflow-credits-gate'
import {
  withRefusalBaseline,
  workflowCreditsGate
} from './workflow-credits-gate'

const idle = { busy: false, member: false, refusal: undefined }

describe('workflowCreditsGate', () => {
  it.for<{
    label: string
    input: Parameters<typeof workflowCreditsGate>[0]
    gate: WorkflowCreditsGate
  }>([
    { label: 'a funded balance', input: { ...idle, credits: 40 }, gate: 'run' },
    {
      label: 'an unread balance',
      input: { ...idle, credits: undefined },
      gate: 'run'
    },
    {
      label: 'an empty balance',
      input: { ...idle, credits: 0 },
      gate: 'noCredits'
    },
    {
      label: "an empty team member's balance",
      input: { ...idle, member: true, credits: 0 },
      gate: 'memberNoCredits'
    },
    {
      label: 'a run in progress on an empty balance',
      input: { ...idle, busy: true, credits: 0 },
      gate: 'run'
    },
    {
      label: 'a refusal with some credits left',
      input: { ...idle, credits: 12, refusal: { credits: 12 } },
      gate: 'noCredits'
    },
    {
      label: 'a refusal before the balance was read',
      input: { ...idle, credits: 12, refusal: { credits: undefined } },
      gate: 'noCredits'
    },
    {
      label: 'a refusal followed by a top-up',
      input: { ...idle, credits: 500, refusal: { credits: 12 } },
      gate: 'run'
    }
  ])('offers $gate for $label', ({ input, gate }) => {
    expect(workflowCreditsGate(input)).toBe(gate)
  })

  it('returns to Run after a top-up that follows a refusal made before the balance was read', () => {
    let refusal = withRefusalBaseline({ credits: undefined }, undefined)
    const gates = [undefined, 12, 500].map((credits) => {
      refusal = withRefusalBaseline(refusal, credits)
      return workflowCreditsGate({ ...idle, credits, refusal })
    })

    expect(gates).toEqual(['noCredits', 'noCredits', 'run'])
  })
})
