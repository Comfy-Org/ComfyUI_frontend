import { describe, expect, it } from 'vitest'

import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { workflowDeploymentOffer } from '@/platform/workspace/workflowDeploymentOffer'

function deployment(id: string): WorkspaceDeployment {
  return {
    deployment_id: id,
    release_id: `rel-${id}`,
    status: 'ready',
    created_at: '2026-10-01T00:00:00Z'
  }
}

const RUNS: DeploymentCompatibilityMark = { kind: 'runs' }
const MISSING: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: ['BiRefNet']
}
const UNKNOWN: DeploymentCompatibilityMark = { kind: 'unknown' }

interface OfferCase {
  when: string
  marks: Record<string, DeploymentCompatibilityMark | null>
  offer: { kind: string; ids?: string[] }
}

const CASES: OfferCase[] = [
  {
    when: 'the check has not answered',
    marks: { a: null, b: null },
    offer: { kind: 'unchecked' }
  },
  {
    when: 'some deployments run it',
    marks: { a: MISSING, b: RUNS, c: RUNS },
    offer: { kind: 'switch', ids: ['b', 'c', 'a'] }
  },
  {
    when: 'one runs it and another was not checked',
    marks: { a: UNKNOWN, b: RUNS },
    offer: { kind: 'switch', ids: ['b', 'a'] }
  },
  {
    when: 'every deployment lacks nodes',
    marks: { a: MISSING, b: MISSING },
    offer: { kind: 'noneRunIt' }
  },
  {
    when: 'none runs it but one was not checked',
    marks: { a: MISSING, b: UNKNOWN },
    offer: { kind: 'unchecked' }
  },
  {
    when: 'the workspace has no deployments',
    marks: {},
    offer: { kind: 'unchecked' }
  }
]

describe(workflowDeploymentOffer, () => {
  it.for(CASES)('offers $offer.kind when $when', ({ marks, offer }) => {
    const result = workflowDeploymentOffer(
      Object.keys(marks).map(deployment),
      (id) => marks[id] ?? null
    )

    expect({
      kind: result.kind,
      ...(result.kind === 'switch' && {
        ids: result.choices.map((choice) => choice.deployment.deployment_id)
      })
    }).toEqual(offer)
  })
})
