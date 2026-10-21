import { describe, expect, it } from 'vitest'

import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import {
  answersForWorkflow,
  workflowDeploymentOffer
} from '@/platform/workspace/workflowDeploymentOffer'
import type { CheckedWorkflow } from '@/platform/workspace/workflowDeploymentOffer'

function deployment(id: string): WorkspaceDeployment {
  return {
    deployment_id: id,
    release_id: `rel-${id}`,
    status: id.startsWith('stopped') ? 'stopped' : 'ready',
    created_at: '2026-10-01T00:00:00Z'
  }
}

const WORKFLOW: CheckedWorkflow = {
  nodeTypes: ['BiRefNet', 'EmptyImage', 'SaveImage'],
  missingNodeTypes: ['BiRefNet']
}

const RUNS: DeploymentCompatibilityMark = { kind: 'runs' }
const MISSING: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: ['BiRefNet']
}
const UNKNOWN: DeploymentCompatibilityMark = { kind: 'unknown' }

interface OfferCase {
  when: string
  cloud?: DeploymentCompatibilityMark | null
  workflow?: CheckedWorkflow
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
    when: 'a stopped deployment and a ready one run it',
    marks: { stopped: RUNS, a: MISSING, b: RUNS },
    offer: { kind: 'switch', ids: ['b', 'stopped', 'a'] }
  },
  {
    when: 'only a stopped deployment runs it',
    marks: { stopped: RUNS, a: MISSING },
    offer: { kind: 'unchecked' }
  },
  {
    when: 'another missing node sits in a muted subgraph the check skips',
    workflow: { ...WORKFLOW, missingNodeTypes: ['BiRefNet', 'MutedNode'] },
    marks: { a: RUNS },
    offer: { kind: 'switch', ids: ['a'] }
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
    when: 'the answer names a node this workflow does not use',
    cloud: { kind: 'missing', nodeTypes: ['BiRefNet', 'RMBG'] },
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
    ({ cloud = MISSING, workflow = WORKFLOW, marks, offer }) => {
      const result = workflowDeploymentOffer(
        Object.keys(marks).map(deployment),
        (id) => (id === null ? cloud : (marks[id] ?? null)),
        workflow
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

describe(answersForWorkflow, () => {
  it.for([
    { when: 'the check has not answered', cloud: null, answers: false },
    {
      when: 'Comfy Cloud runs it because every missing node is muted',
      cloud: RUNS,
      workflow: { nodeTypes: ['SaveImage'], missingNodeTypes: ['MutedNode'] },
      answers: true
    },
    {
      when: 'it finds Comfy Cloud lacking those nodes',
      cloud: MISSING,
      answers: true
    }
  ] satisfies {
    when: string
    cloud: DeploymentCompatibilityMark | null
    workflow?: CheckedWorkflow
    answers: boolean
  }[])('is $answers when $when', ({ cloud, workflow = WORKFLOW, answers }) => {
    expect(answersForWorkflow(() => cloud, workflow)).toBe(answers)
  })
})
