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

function listedAs(status: string): DeploymentStartEvent {
  const deployment: WorkspaceDeployment = {
    deployment_id: ID,
    release_id: 'r-1',
    status,
    created_at: '2026-10-01T00:00:00Z'
  }
  return { type: 'listed', deployments: [deployment] }
}

function startsWith(start?: DeploymentStart) {
  return new Map(start ? [[ID, start]] : [])
}

describe('reduceDeploymentStarts', () => {
  it.for([
    {
      name: 'a Start is asked for',
      before: undefined,
      event: { type: 'requested', deploymentId: ID },
      after: { phase: 'requested' }
    },
    {
      name: 'a second Start while one is on its way',
      before: { phase: 'accepted', seenStarting: false },
      event: { type: 'requested', deploymentId: ID },
      after: { phase: 'accepted', seenStarting: false }
    },
    {
      name: 'a retry after a refusal',
      before: { phase: 'refused', reason: 'noCredits', message: null },
      event: { type: 'requested', deploymentId: ID },
      after: { phase: 'requested' }
    },
    {
      name: 'the server takes the Start',
      before: { phase: 'requested' },
      event: { type: 'answered', deploymentId: ID, outcome: { ok: true } },
      after: { phase: 'accepted', seenStarting: false }
    },
    {
      name: 'the server refuses the Start',
      before: { phase: 'requested' },
      event: {
        type: 'answered',
        deploymentId: ID,
        outcome: { ok: false, reason: 'noCredits', message: 'No credits' }
      },
      after: { phase: 'refused', reason: 'noCredits', message: 'No credits' }
    },
    {
      name: 'an answer nobody is waiting for',
      before: undefined,
      event: { type: 'answered', deploymentId: ID, outcome: { ok: true } },
      after: undefined
    },
    {
      name: 'the listing shows it on its way',
      before: { phase: 'accepted', seenStarting: false },
      event: listedAs('provisioning'),
      after: { phase: 'accepted', seenStarting: true }
    },
    {
      name: 'the listing still shows it stopped right after the Start',
      before: { phase: 'accepted', seenStarting: false },
      event: listedAs('stopped'),
      after: { phase: 'accepted', seenStarting: false }
    },
    {
      name: 'it fails after the listing showed it on its way',
      before: { phase: 'accepted', seenStarting: true },
      event: listedAs('failed'),
      after: { phase: 'refused', reason: 'failed', message: null }
    },
    {
      name: 'it is ready',
      before: { phase: 'accepted', seenStarting: true },
      event: listedAs('ready'),
      after: undefined
    },
    {
      name: 'a refused one is started elsewhere and is ready',
      before: { phase: 'refused', reason: 'tooManyRunning', message: null },
      event: listedAs('ready'),
      after: undefined
    },
    {
      name: 'a refused one is still stopped',
      before: { phase: 'refused', reason: 'tooManyRunning', message: null },
      event: listedAs('stopped'),
      after: { phase: 'refused', reason: 'tooManyRunning', message: null }
    },
    {
      name: 'it is gone from the listing',
      before: { phase: 'accepted', seenStarting: true },
      event: { type: 'listed', deployments: [] },
      after: undefined
    }
  ] satisfies {
    name: string
    before: DeploymentStart | undefined
    event: DeploymentStartEvent
    after: DeploymentStart | undefined
  }[])('when $name', ({ before, event, after }) => {
    expect(reduceDeploymentStarts(startsWith(before), event).get(ID)).toEqual(
      after
    )
  })
})

describe('deploymentRowAction', () => {
  it.for([
    { status: 'ready', start: undefined, offered: true, action: 'pick' },
    { status: 'stopped', start: undefined, offered: true, action: 'start' },
    { status: 'failed', start: undefined, offered: true, action: 'start' },
    { status: 'stopped', start: undefined, offered: false, action: 'open' },
    { status: 'failed', start: undefined, offered: false, action: 'open' },
    { status: 'stopping', start: undefined, offered: false, action: 'none' },
    { status: 'starting', start: undefined, offered: true, action: 'none' },
    { status: 'stopping', start: undefined, offered: true, action: 'none' },
    {
      status: 'stopped',
      start: { phase: 'requested' },
      offered: true,
      action: 'none'
    },
    {
      status: 'stopped',
      start: { phase: 'refused', reason: 'noCredits', message: null },
      offered: true,
      action: 'retry'
    },
    {
      status: 'stopped',
      start: { phase: 'refused', reason: 'unavailable', message: null },
      offered: true,
      action: 'open'
    }
  ] satisfies {
    status: string
    start: DeploymentStart | undefined
    offered: boolean
    action: string
  }[])(
    'a $status row with Start offered $offered and start $start.phase is $action',
    ({ status, start, offered, action }) => {
      expect(
        deploymentRowAction(status, start, { startOffered: offered })
      ).toBe(action)
    }
  )
})

describe('deploymentRowReason', () => {
  it.for([
    { status: 'ready', action: 'pick', start: undefined, reason: null },
    { status: 'stopped', action: 'start', start: undefined, reason: 'stopped' },
    { status: 'failed', action: 'start', start: undefined, reason: 'failed' },
    {
      status: 'stopped',
      action: 'open',
      start: undefined,
      reason: 'startElsewhere'
    },
    { status: 'queued', action: 'none', start: undefined, reason: 'starting' },
    {
      status: 'stopped',
      action: 'none',
      start: { phase: 'accepted', seenStarting: false },
      reason: 'starting'
    },
    {
      status: 'stopping',
      action: 'none',
      start: undefined,
      reason: 'notReady'
    },
    {
      status: 'stopped',
      action: 'open',
      start: { phase: 'refused', reason: 'unavailable', message: null },
      reason: null
    },
    {
      status: 'stopped',
      action: 'retry',
      start: { phase: 'refused', reason: 'noCredits', message: null },
      reason: null
    }
  ] satisfies {
    status: string
    action: DeploymentRowAction
    start: DeploymentStart | undefined
    reason: string | null
  }[])(
    'a $status row whose action is $action says $reason',
    ({ status, action, start, reason }) => {
      expect(deploymentRowReason(status, action, start)).toBe(reason)
    }
  )
})
