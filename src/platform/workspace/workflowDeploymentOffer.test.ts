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

const MISSING_NODE_TYPES = ['BiRefNet']

const RUNS: DeploymentCompatibilityMark = { kind: 'runs' }
const MISSING: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: MISSING_NODE_TYPES
}
const UNKNOWN: DeploymentCompatibilityMark = { kind: 'unknown' }

interface OfferCase {
  when: string
  cloud?: DeploymentCompatibilityMark | null
  marks: Record<string, DeploymentCompatibilityMark | null>
  offer: { kind: string; ids?: string[] }
}

const CASES: OfferCase[] = [
  {
    when: 'the check has not answered',
    cloud: null,
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
  },
  {
    when: 'the answer is for a workflow missing other nodes',
    cloud: { kind: 'missing', nodeTypes: ['RMBG'] },
    marks: { a: RUNS },
    offer: { kind: 'unchecked' }
  },
  {
    when: 'the check finds Comfy Cloud runs it',
    cloud: RUNS,
    marks: { a: RUNS },
    offer: { kind: 'unchecked' }
  }
]

describe(workflowDeploymentOffer, () => {
  it.for(CASES)(
    'offers $offer.kind when $when',
    ({ cloud = MISSING, marks, offer }) => {
      const result = workflowDeploymentOffer(
        Object.keys(marks).map(deployment),
        (id) => (id === null ? cloud : (marks[id] ?? null)),
        MISSING_NODE_TYPES
      )

      expect({
        kind: result.kind,
        ...(result.kind === 'switch' && {
          ids: result.choices.map((choice) => choice.deployment.deployment_id)
        })
      }).toEqual(offer)
    }
  )
})
