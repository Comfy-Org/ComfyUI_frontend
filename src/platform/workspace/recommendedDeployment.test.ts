import { describe, expect, it } from 'vitest'

import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

import { recommendedDeploymentId } from './recommendedDeployment'

const runs: DeploymentCompatibilityMark = { kind: 'runs' }
const missing: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: ['Image Saver']
}
const unknown: DeploymentCompatibilityMark = { kind: 'unknown' }

type Marks = Record<string, DeploymentCompatibilityMark | null>

function deployment(
  id: string,
  status: WorkspaceDeployment['status']
): WorkspaceDeployment {
  return {
    deployment_id: id,
    release_id: `release-${id}`,
    status,
    can_start: status !== 'ready',
    created_at: '2026-10-01T00:00:00Z'
  }
}

const picked = deployment('picked', 'stopped')

describe('recommendedDeploymentId', () => {
  it.for<{
    when: string
    others: WorkspaceDeployment[]
    marks: Marks
    recommended: string | null
  }>([
    {
      when: 'Comfy Cloud runs the workflow',
      others: [deployment('a', 'ready')],
      marks: { cloud: runs, a: runs, picked: runs },
      recommended: null
    },
    {
      when: 'nothing is checked',
      others: [deployment('a', 'ready')],
      marks: { cloud: null, a: null, picked: null },
      recommended: null
    },
    {
      when: 'Comfy Cloud lacks nodes that a ready deployment has',
      others: [deployment('a', 'ready'), deployment('b', 'ready')],
      marks: { cloud: missing, a: missing, b: runs, picked: runs },
      recommended: 'b'
    },
    {
      when: 'only a stopped deployment has the nodes Comfy Cloud lacks',
      others: [deployment('a', 'stopped'), deployment('b', 'failed')],
      marks: { cloud: missing, a: runs, b: runs, picked: runs },
      recommended: null
    },
    {
      when: 'only the picked deployment has the nodes Comfy Cloud lacks',
      others: [deployment('a', 'ready')],
      marks: { cloud: missing, a: missing, picked: runs },
      recommended: null
    },
    {
      when: 'the check could not answer for the other ready deployment',
      others: [deployment('a', 'ready')],
      marks: { cloud: missing, a: unknown, picked: runs },
      recommended: null
    }
  ])('recommends $recommended when $when', ({ others, marks, recommended }) => {
    expect(
      recommendedDeploymentId(
        [picked, ...others],
        (id) => marks[id ?? 'cloud'] ?? null,
        picked.deployment_id
      )
    ).toBe(recommended)
  })
})
