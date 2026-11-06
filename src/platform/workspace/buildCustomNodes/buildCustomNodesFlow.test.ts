import { describe, expect, it } from 'vitest'

import type {
  BuildCustomNodesEvent,
  BuildCustomNodesState,
  BuildSession
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import { reduceBuildCustomNodes } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type {
  DeploymentBuild,
  NodePack,
  ReleaseBuild
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'

const BUILD: DeploymentBuild = {
  revision: 7,
  pending_update: null,
  release: { release_id: 'rel-3', version: 3 },
  build: {
    build_id: 'bld-1',
    name: 'Studio Build',
    updated_at: '2026-11-05T10:00:00Z',
    custom_nodes: []
  },
  can_change_build: true
}

const PACK: NodePack = {
  id: 'comfyui-impact-pack',
  name: 'ComfyUI Impact Pack',
  publisher: 'Dr.Lt.Data',
  installs: 1,
  stars: 1,
  license: '',
  latestVersion: '8.30.0'
}

const LATEST = { kind: 'latest', version: '8.30.0' } as const
const PINNED = { kind: 'version', version: '8.29.1' } as const

const EMPTY: BuildSession = {
  deploymentId: 'dep-prod',
  deploymentName: 'production',
  build: BUILD,
  picks: []
}
const PICKED: BuildSession = {
  ...EMPTY,
  picks: [{ pack: PACK, choice: LATEST }]
}

function release(overrides: Partial<ReleaseBuild> = {}): ReleaseBuild {
  return {
    release_id: 'rel-4',
    version: 4,
    status: 'building',
    deployable: false,
    target: { status: 'building' },
    timeline: [],
    ...overrides
  }
}

const BUILDING: BuildCustomNodesState = {
  phase: 'building',
  session: PICKED,
  release: { release_id: 'rel-4', version: 4 },
  progress: null,
  startedAt: 0
}

describe('reduceBuildCustomNodes', () => {
  it.for<{
    name: string
    before: BuildCustomNodesState
    event: BuildCustomNodesEvent
    after: BuildCustomNodesState
  }>([
    {
      name: 'a Build its viewer may change opens the picker',
      before: {
        phase: 'loading',
        deploymentId: 'dep-prod',
        deploymentName: 'production'
      },
      event: { type: 'loaded', build: BUILD },
      after: { phase: 'picking', session: EMPTY }
    },
    {
      name: 'a Build its viewer may not change opens read-only',
      before: {
        phase: 'loading',
        deploymentId: 'dep-prod',
        deploymentName: 'production'
      },
      event: { type: 'loaded', build: { ...BUILD, can_change_build: false } },
      after: {
        phase: 'viewing',
        session: { ...EMPTY, build: { ...BUILD, can_change_build: false } }
      }
    },
    {
      name: 'ticking a pack picks it at its version',
      before: { phase: 'picking', session: EMPTY },
      event: { type: 'packToggled', pack: PACK, choice: LATEST },
      after: { phase: 'picking', session: PICKED }
    },
    {
      name: 'ticking a picked pack drops it',
      before: { phase: 'picking', session: PICKED },
      event: { type: 'packToggled', pack: PACK, choice: LATEST },
      after: { phase: 'picking', session: EMPTY }
    },
    {
      name: 'choosing a version picks the pack at that version',
      before: { phase: 'picking', session: EMPTY },
      event: { type: 'versionChosen', pack: PACK, choice: PINNED },
      after: {
        phase: 'picking',
        session: { ...EMPTY, picks: [{ pack: PACK, choice: PINNED }] }
      }
    },
    {
      name: 'review needs a pick',
      before: { phase: 'picking', session: EMPTY },
      event: { type: 'reviewRequested' },
      after: { phase: 'picking', session: EMPTY }
    },
    {
      name: 'a refused save returns to review with the reason',
      before: { phase: 'submitting', session: PICKED },
      event: { type: 'refused', message: 'Someone else changed this Build.' },
      after: {
        phase: 'reviewing',
        session: PICKED,
        refusal: 'Someone else changed this Build.'
      }
    },
    {
      name: 'a Release still building updates the progress',
      before: BUILDING,
      event: { type: 'releaseProgressed', release: release() },
      after: { ...BUILDING, progress: release() }
    },
    {
      name: 'a deployable Release moves on to the redeploy',
      before: BUILDING,
      event: {
        type: 'releaseProgressed',
        release: release({ status: 'complete', deployable: true })
      },
      after: {
        phase: 'redeploying',
        session: PICKED,
        release: release({ status: 'complete', deployable: true })
      }
    },
    {
      name: 'a complete Release that cannot deploy failed',
      before: BUILDING,
      event: {
        type: 'releaseProgressed',
        release: release({ status: 'complete' })
      },
      after: {
        phase: 'buildFailed',
        session: PICKED,
        release: release({ status: 'complete' })
      }
    },
    {
      name: 'another Release answering is ignored',
      before: BUILDING,
      event: {
        type: 'releaseProgressed',
        release: release({ release_id: 'rel-old', status: 'complete' })
      },
      after: BUILDING
    },
    {
      name: 'changing node packs after a failure keeps the picks',
      before: {
        phase: 'buildFailed',
        session: PICKED,
        release: release({ status: 'complete' })
      },
      event: { type: 'backToPicking' },
      after: { phase: 'picking', session: PICKED }
    },
    {
      name: 'building again after a failure starts a new Release',
      before: {
        phase: 'buildFailed',
        session: PICKED,
        release: release({ status: 'complete' })
      },
      event: { type: 'retried' },
      after: {
        phase: 'building',
        session: PICKED,
        release: null,
        progress: null,
        startedAt: null
      }
    },
    {
      name: 'closing the dialog does not stop a build',
      before: BUILDING,
      event: { type: 'dismissed' },
      after: BUILDING
    },
    {
      name: 'reopening during a build keeps showing it',
      before: BUILDING,
      event: {
        type: 'opened',
        deploymentId: 'dep-prod',
        deploymentName: 'production'
      },
      after: BUILDING
    },
    {
      name: 'the move landing ends the flow',
      before: {
        phase: 'redeploying',
        session: PICKED,
        release: release({ status: 'complete', deployable: true })
      },
      event: { type: 'moveLanded' },
      after: { phase: 'idle' }
    }
  ])('$name', ({ before, event, after }) => {
    expect(reduceBuildCustomNodes(before, event)).toEqual(after)
  })
})
