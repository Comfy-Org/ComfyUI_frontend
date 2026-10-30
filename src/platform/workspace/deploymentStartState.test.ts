import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import type {
  DeploymentRowAction,
  DeploymentStart,
  DeploymentStartEvent
} from './deploymentStartState'
import {
  deploymentRowAction,
  deploymentRowReason,
  reduceDeploymentStarts
} from './deploymentStartState'

const ID = 'dep-a1a1a1a1-0000-4000-8000-000000000001'

function deploymentAt(
  status: WorkspaceDeployment['status'],
  canStart = false
): WorkspaceDeployment {
  return {
    deployment_id: ID,
    release_id: 'r-1',
    status,
    can_start: canStart,
    created_at: '2026-10-01T00:00:00Z'
  }
}

function startsWith(start?: DeploymentStart) {
  return new Map(start ? [[ID, start]] : [])
}

const refused: DeploymentStart = {
  phase: 'refused',
  reason: 'noCredits',
  message: 'No credits'
}

describe('reduceDeploymentStarts', () => {
  it.for<{
    name: string
    before: DeploymentStart | undefined
    event: DeploymentStartEvent
    after: DeploymentStart | undefined
  }>([
    {
      name: 'a Start is asked for',
      before: undefined,
      event: { type: 'requested', deploymentId: ID },
      after: { phase: 'requested' }
    },
    {
      name: 'a retry after a refusal',
      before: refused,
      event: { type: 'requested', deploymentId: ID },
      after: { phase: 'requested' }
    },
    {
      name: 'the server takes the Start and the listing after it lands',
      before: { phase: 'requested' },
      event: { type: 'taken', deploymentId: ID },
      after: undefined
    },
    {
      name: 'the server refuses the Start',
      before: { phase: 'requested' },
      event: {
        type: 'refused',
        deploymentId: ID,
        reason: 'noCredits',
        message: 'No credits'
      },
      after: refused
    },
    {
      name: 'a refusal for a Start no longer asked for',
      before: undefined,
      event: {
        type: 'refused',
        deploymentId: ID,
        reason: 'failed',
        message: null
      },
      after: undefined
    },
    {
      name: 'a listing while the Start is asked for',
      before: { phase: 'requested' },
      event: { type: 'listed', deployments: [deploymentAt('stopped', true)] },
      after: { phase: 'requested' }
    },
    {
      name: 'a listing that says the refused deployment can still start',
      before: refused,
      event: { type: 'listed', deployments: [deploymentAt('failed', true)] },
      after: refused
    },
    {
      name: 'a listing that shows the refused deployment started elsewhere',
      before: refused,
      event: { type: 'listed', deployments: [deploymentAt('queued')] },
      after: undefined
    },
    {
      name: 'a listing without the deployment',
      before: { phase: 'requested' },
      event: { type: 'listed', deployments: [] },
      after: undefined
    }
  ])('$name', ({ before, event, after }) => {
    expect(reduceDeploymentStarts(startsWith(before), event).get(ID)).toEqual(
      after
    )
  })

  it('keeps the Start asked for when the same Start is asked for again', () => {
    const starts = startsWith({ phase: 'requested' })

    expect(
      reduceDeploymentStarts(starts, { type: 'requested', deploymentId: ID })
    ).toBe(starts)
  })
})

describe('deploymentRowAction', () => {
  it.for<{
    name: string
    deployment: WorkspaceDeployment
    start?: DeploymentStart
    startOffered: boolean
    action: DeploymentRowAction
  }>([
    {
      name: 'a ready deployment is picked',
      deployment: deploymentAt('ready'),
      startOffered: true,
      action: 'pick'
    },
    {
      name: 'one the listing says can start offers Start',
      deployment: deploymentAt('stopped', true),
      startOffered: true,
      action: 'start'
    },
    {
      name: 'one the listing says can start opens the Developer Platform while Start is not offered',
      deployment: deploymentAt('failed', true),
      startOffered: false,
      action: 'open'
    },
    {
      name: 'one the listing says cannot start does nothing, whatever its status',
      deployment: deploymentAt('stopped'),
      startOffered: true,
      action: 'none'
    },
    {
      name: 'one on its way up does nothing',
      deployment: deploymentAt('provisioning'),
      startOffered: true,
      action: 'none'
    },
    {
      name: 'one whose Start is asked for does nothing',
      deployment: deploymentAt('stopped', true),
      start: { phase: 'requested' },
      startOffered: true,
      action: 'none'
    },
    {
      name: 'a refused Start is retried',
      deployment: deploymentAt('stopped', true),
      start: refused,
      startOffered: true,
      action: 'retry'
    },
    {
      name: 'a Start this editor cannot ask for opens the Developer Platform',
      deployment: deploymentAt('stopped', true),
      start: { phase: 'refused', reason: 'unavailable', message: null },
      startOffered: true,
      action: 'open'
    },
    {
      name: 'a refused Start opens the Developer Platform once Start is not offered',
      deployment: deploymentAt('stopped', true),
      start: refused,
      startOffered: false,
      action: 'open'
    }
  ])('$name', ({ deployment, start, startOffered, action }) => {
    expect(deploymentRowAction(deployment, start, { startOffered })).toBe(
      action
    )
  })
})

describe('deploymentRowReason', () => {
  it.for<{
    name: string
    deployment: WorkspaceDeployment
    action: DeploymentRowAction
    start?: DeploymentStart
    reason: ReturnType<typeof deploymentRowReason>
  }>([
    {
      name: 'a ready row needs none',
      deployment: deploymentAt('ready'),
      action: 'pick',
      reason: null
    },
    {
      name: 'a refused row says why in its own text',
      deployment: deploymentAt('stopped', true),
      action: 'retry',
      start: refused,
      reason: null
    },
    {
      name: 'a row whose Start is asked for is starting',
      deployment: deploymentAt('stopped', true),
      action: 'none',
      start: { phase: 'requested' },
      reason: 'starting'
    },
    {
      name: 'a row on its way up is starting',
      deployment: deploymentAt('queued'),
      action: 'none',
      reason: 'starting'
    },
    {
      name: 'a stopped row offering Start is stopped',
      deployment: deploymentAt('stopped', true),
      action: 'start',
      reason: 'stopped'
    },
    {
      name: 'a failed row offering Start failed',
      deployment: deploymentAt('failed', true),
      action: 'start',
      reason: 'failed'
    },
    {
      name: 'a row opening the Developer Platform says to start it there',
      deployment: deploymentAt('stopped', true),
      action: 'open',
      reason: 'startElsewhere'
    },
    {
      name: 'any other row is not ready',
      deployment: deploymentAt('stopping'),
      action: 'none',
      reason: 'notReady'
    }
  ])('$name', ({ deployment, action, start, reason }) => {
    expect(deploymentRowReason(deployment, action, start)).toBe(reason)
  })
})
