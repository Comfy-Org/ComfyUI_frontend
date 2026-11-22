import { describe, expect, it } from 'vitest'

import { advanceBuild, isInFlight, startFollowing } from './platformFrameBuild'
import type { FollowedBuild } from './platformFrameBuild'

const started = {
  type: 'build-started',
  kind: 'update',
  buildId: 'b-1',
  releaseId: 'r-2',
  version: 2,
  deploymentId: 'dep-1',
  deploymentName: 'portrait-upscale'
} as const

function following(): FollowedBuild {
  return startFollowing(started, { release_id: 'r-1', release_version: 1 })
}

describe('startFollowing', () => {
  it('remembers the release the deployment ran before the update', () => {
    expect(following()).toEqual({
      kind: 'update',
      deploymentId: 'dep-1',
      deploymentName: 'portrait-upscale',
      releaseId: 'r-2',
      version: 2,
      previousReleaseId: 'r-1',
      previousVersion: 1,
      stage: 'building',
      progress: null
    })
  })

  it('has no earlier release for a new deployment', () => {
    const build = startFollowing({ ...started, kind: 'new' }, undefined)

    expect(build).toMatchObject({
      previousReleaseId: null,
      previousVersion: null
    })
  })
})

describe('advanceBuild', () => {
  it.for([
    {
      message: {
        type: 'build-progress',
        releaseId: 'r-2',
        step: 2,
        of: 5,
        label: 'Installing nodes'
      },
      changes: { stage: 'building', progress: { step: 2, of: 5 } }
    },
    {
      message: { type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'dep-1' },
      changes: { stage: 'deploying' }
    },
    {
      message: {
        type: 'build-waiting',
        releaseId: 'r-2',
        deploymentId: 'dep-1'
      },
      changes: { stage: 'waiting' }
    },
    {
      message: { type: 'build-failed', releaseId: 'r-2', reason: 'pip' },
      changes: { stage: 'failed' }
    },
    {
      message: {
        type: 'deploy-failed',
        releaseId: 'r-2',
        deploymentId: 'dep-1',
        reason: 'no GPU'
      },
      changes: { stage: 'failed' }
    }
  ] as const)('moves on $message.type', ({ message, changes }) => {
    expect(advanceBuild(following(), message)).toMatchObject(changes)
  })

  it('ignores a message about another release', () => {
    const build = following()

    expect(
      advanceBuild(build, {
        type: 'deploy-sent',
        releaseId: 'r-9',
        deploymentId: 'dep-1'
      })
    ).toBe(build)
  })

  it('stops counting a failed build as in flight', () => {
    const failed = advanceBuild(following(), {
      type: 'build-failed',
      releaseId: 'r-2',
      reason: 'pip'
    })

    expect(isInFlight(following())).toBe(true)
    expect(isInFlight(failed)).toBe(false)
    expect(isInFlight(null)).toBe(false)
  })
})
