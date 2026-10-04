import { describe, expect, it } from 'vitest'

import type { WorkspaceDeployment } from '@comfyorg/ingest-types'

import type {
  DeploymentPickEvent,
  DeploymentPickState
} from './deploymentPickState'
import { loadedEvent, reduceDeploymentPick } from './deploymentPickState'

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

  it('loads into ready, or into hidden when refused or failed with nothing shown', () => {
    expect(reduceDeploymentPick({ phase: 'idle' }, loaded)).toEqual(ready)
    expect(reduceDeploymentPick({ phase: 'hidden' }, loaded)).toEqual(ready)
    for (const state of [
      { phase: 'idle' },
      { phase: 'hidden' }
    ] satisfies DeploymentPickState[]) {
      expect(reduceDeploymentPick(state, { type: 'loadRefused' })).toEqual({
        phase: 'hidden'
      })
      expect(reduceDeploymentPick(state, { type: 'loadFailed' })).toEqual({
        phase: 'hidden'
      })
    }
  })

  it('keeps a listing on screen when a reload of it fails, but hides on a refusal', () => {
    expect(reduceDeploymentPick(ready, { type: 'loadFailed' })).toBe(ready)
    expect(reduceDeploymentPick(switching, { type: 'loadFailed' })).toBe(
      switching
    )
    expect(reduceDeploymentPick(ready, { type: 'loadRefused' })).toEqual({
      phase: 'hidden'
    })
  })

  it('switches only from ready, and a failed switch returns to ready', () => {
    expect(
      reduceDeploymentPick(ready, { type: 'switchStarted', target: null })
    ).toEqual(switching)
    expect(reduceDeploymentPick(switching, { type: 'switchFailed' })).toEqual(
      ready
    )

    for (const state of [
      { phase: 'idle' },
      { phase: 'hidden' }
    ] satisfies DeploymentPickState[]) {
      expect(
        reduceDeploymentPick(state, { type: 'switchStarted', target: 'dep-1' })
      ).toBe(state)
    }
    expect(reduceDeploymentPick(ready, { type: 'switchFailed' })).toBe(ready)
  })

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
    // A refusal that landed meanwhile still hides it.
    const hidden: DeploymentPickState = { phase: 'hidden' }
    expect(
      reduceDeploymentPick(hidden, {
        type: 'defaultChanged',
        defaultDeploymentId: 'dep-1'
      })
    ).toBe(hidden)
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
