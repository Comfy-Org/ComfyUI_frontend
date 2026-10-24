import { describe, expect, it } from 'vitest'

import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'

import type {
  DeploymentPickEvent,
  DeploymentPickState
} from './deploymentPickState'
import {
  changeBetween,
  loadedEvent,
  reduceDeploymentPick
} from './deploymentPickState'

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  release_id: 'r-1',
  build_name: 'Studio Build',
  release_version: 1,
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

const loaded: DeploymentPickEvent = {
  type: 'loaded',
  deployments: [deployment],
  pickedDeploymentId: 'dep-1',
  pickSource: 'browser',
  defaultDeploymentId: null,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
}

const ready: DeploymentPickState = {
  phase: 'ready',
  deployments: [deployment],
  pickedDeploymentId: 'dep-1',
  pickSource: 'browser',
  defaultDeploymentId: null,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
}

describe('reduceDeploymentPick', () => {
  const switching: DeploymentPickState = {
    ...ready,
    phase: 'switching',
    target: null
  }

  const nothingShown: DeploymentPickState[] = [
    { phase: 'idle' },
    { phase: 'hidden' }
  ]

  it.for(nothingShown)(
    'loads into ready from $phase, or into hidden when refused or failed',
    (state) => {
      expect(reduceDeploymentPick(state, loaded)).toEqual(ready)
      expect(reduceDeploymentPick(state, { type: 'loadRefused' })).toEqual({
        phase: 'hidden'
      })
      expect(reduceDeploymentPick(state, { type: 'loadFailed' })).toEqual({
        phase: 'hidden'
      })
    }
  )

  it('keeps a listing on screen when a reload of it fails, but hides on a refusal', () => {
    expect(reduceDeploymentPick(ready, { type: 'loadFailed' })).toBe(ready)
    expect(reduceDeploymentPick(switching, { type: 'loadFailed' })).toBe(
      switching
    )
    expect(reduceDeploymentPick(ready, { type: 'loadRefused' })).toEqual({
      phase: 'hidden'
    })
  })

  it('restores the listing after a failed switch', () => {
    expect(
      reduceDeploymentPick(ready, { type: 'switchStarted', target: null })
    ).toEqual(switching)
    expect(reduceDeploymentPick(switching, { type: 'switchFailed' })).toEqual(
      ready
    )
    expect(reduceDeploymentPick(ready, { type: 'switchFailed' })).toBe(ready)
  })

  it.for(nothingShown)(
    'tracks a link switch without a listing from $phase',
    (state) => {
      const pending = reduceDeploymentPick(state, {
        type: 'switchStarted',
        target: 'dep-1'
      })
      expect(pending.phase).toBe('switching')
      expect(reduceDeploymentPick(pending, { type: 'loadFailed' })).toBe(
        pending
      )
      expect(reduceDeploymentPick(pending, { type: 'switchFailed' })).toEqual(
        state
      )
      expect(reduceDeploymentPick(pending, loaded)).toEqual({
        ...ready,
        phase: 'switching',
        target: 'dep-1'
      })
      const refused = reduceDeploymentPick(pending, { type: 'loadRefused' })
      expect(refused.phase).toBe('switching')
      expect(
        reduceDeploymentPick(refused, {
          type: 'defaultChanged',
          defaultDeploymentId: 'dep-1'
        })
      ).toEqual({ phase: 'hidden' })
      expect(reduceDeploymentPick(refused, { type: 'switchFailed' })).toEqual({
        phase: 'hidden'
      })
    }
  )

  it.for([ready, switching])(
    'forgets the listing from $phase when the workspace changes',
    (state) => {
      expect(reduceDeploymentPick(state, { type: 'workspaceChanged' })).toEqual(
        { phase: 'idle' }
      )
    }
  )

  it('keeps a switch in flight when a listing lands, and takes the new listing', () => {
    const newer: DeploymentPickEvent = {
      ...loaded,
      pickedDeploymentId: null,
      pickSource: null,
      defaultDeploymentId: 'dep-1'
    }
    const landed = reduceDeploymentPick(
      { ...switching, target: 'dep-1' },
      newer
    )
    expect(landed).toEqual({
      phase: 'switching',
      target: 'dep-1',
      deployments: [deployment],
      pickedDeploymentId: null,
      pickSource: null,
      defaultDeploymentId: 'dep-1',
      gonePickedDeploymentId: null,
      goneDefaultDeploymentId: null,
      buildsVisible: true
    })
    // A refused switch then returns to the newer listing, not the old one.
    expect(reduceDeploymentPick(landed, { type: 'switchFailed' })).toEqual({
      ...ready,
      pickedDeploymentId: null,
      pickSource: null,
      defaultDeploymentId: 'dep-1'
    })
  })

  it('keeps a switch in flight, hidden, when a refresh is refused, until it ends or a listing lands', () => {
    const refused = reduceDeploymentPick(
      { ...switching, target: 'dep-1' },
      { type: 'loadRefused' }
    )
    expect(refused).toEqual({
      phase: 'switching',
      target: 'dep-1',
      previousPhase: 'hidden'
    })
    expect(reduceDeploymentPick(refused, { type: 'loadFailed' })).toBe(refused)
    expect(
      reduceDeploymentPick(refused, { type: 'switchStarted', target: null })
    ).toBe(refused)
    expect(reduceDeploymentPick(refused, loaded)).toEqual({
      ...ready,
      phase: 'switching',
      target: 'dep-1'
    })
    expect(reduceDeploymentPick(refused, { type: 'switchFailed' })).toEqual({
      phase: 'hidden'
    })
    expect(
      reduceDeploymentPick(refused, {
        type: 'defaultChanged',
        defaultDeploymentId: 'dep-1'
      })
    ).toEqual({ phase: 'hidden' })
    expect(reduceDeploymentPick(refused, { type: 'workspaceChanged' })).toEqual(
      { phase: 'idle' }
    )
  })

  it('a new default the server took ends the switch and shows at once', () => {
    expect(
      reduceDeploymentPick(switching, {
        type: 'defaultChanged',
        defaultDeploymentId: 'dep-1'
      })
    ).toEqual({ ...ready, defaultDeploymentId: 'dep-1' })
    expect(
      reduceDeploymentPick(
        { ...switching, defaultDeploymentId: 'dep-1' },
        { type: 'defaultChanged', defaultDeploymentId: null }
      )
    ).toEqual(ready)
    expect(
      reduceDeploymentPick(
        { ...switching, goneDefaultDeploymentId: 'dep-gone' },
        { type: 'defaultChanged', defaultDeploymentId: null }
      )
    ).toEqual(ready)
    // A refusal that landed meanwhile still hides it.
    const hidden: DeploymentPickState = { phase: 'hidden' }
    expect(
      reduceDeploymentPick(hidden, {
        type: 'defaultChanged',
        defaultDeploymentId: 'dep-1'
      })
    ).toBe(hidden)
  })

  it('following the default in place ends the switch on the same deployment', () => {
    expect(
      reduceDeploymentPick(
        { ...switching, defaultDeploymentId: 'dep-1' },
        { type: 'followedInPlace' }
      )
    ).toEqual({
      ...ready,
      defaultDeploymentId: 'dep-1',
      pickSource: 'workspace_default'
    })
    const hidden: DeploymentPickState = { phase: 'hidden' }
    expect(reduceDeploymentPick(hidden, { type: 'followedInPlace' })).toBe(
      hidden
    )
  })
})

describe('loadedEvent', () => {
  it('carries the gone pick and the gone default ingest reports', () => {
    expect(
      loadedEvent({
        items: [deployment],
        builds_visible: true,
        gone_picked_deployment_id: 'dep-9',
        gone_default_deployment_id: 'dep-8'
      })
    ).toMatchObject({
      pickedDeploymentId: null,
      defaultDeploymentId: null,
      gonePickedDeploymentId: 'dep-9',
      goneDefaultDeploymentId: 'dep-8'
    })
  })

  it('carries the listing, with absent fields as null', () => {
    expect(
      loadedEvent({
        items: [deployment],
        pick_source: 'browser',
        builds_visible: false
      })
    ).toEqual({
      type: 'loaded',
      deployments: [deployment],
      pickedDeploymentId: null,
      pickSource: 'browser',
      defaultDeploymentId: null,
      gonePickedDeploymentId: null,
      goneDefaultDeploymentId: null,
      buildsVisible: false
    })
  })

  it('keeps the pick and the workspace default the listing names', () => {
    expect(
      loadedEvent({
        items: [deployment],
        picked_deployment_id: 'dep-1',
        pick_source: 'workspace_default',
        default_deployment_id: 'dep-1',
        builds_visible: true
      })
    ).toMatchObject({
      pickedDeploymentId: 'dep-1',
      pickSource: 'workspace_default',
      defaultDeploymentId: 'dep-1'
    })
  })
})

describe('changeBetween', () => {
  const updated = { ...deployment, release_id: 'r-2' }
  const other = { ...deployment, deployment_id: 'dep-2', release_id: 'r-3' }
  const sameRelease = { ...deployment, deployment_id: 'dep-2' }

  it.for([
    {
      name: 'the same deployment',
      boot: deployment,
      now: deployment,
      change: null
    },
    { name: 'Comfy Cloud both times', boot: null, now: null, change: null },
    {
      name: 'a new Release',
      boot: deployment,
      now: updated,
      change: 'release'
    },
    {
      name: 'another deployment',
      boot: deployment,
      now: other,
      change: 'deployment'
    },
    {
      name: 'Comfy Cloud after a deployment',
      boot: deployment,
      now: null,
      change: 'deployment'
    },
    {
      name: 'a deployment after Comfy Cloud',
      boot: null,
      now: deployment,
      change: 'deployment'
    },
    {
      name: 'another deployment on the same Release',
      boot: deployment,
      now: sameRelease,
      change: null
    }
  ])('reports $change for $name', ({ boot, now, change }) => {
    expect(changeBetween(boot, now)).toBe(change)
  })
})
