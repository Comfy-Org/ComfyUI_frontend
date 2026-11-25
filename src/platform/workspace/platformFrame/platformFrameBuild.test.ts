import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  KEPT_BUILD_KEY,
  KEPT_BUILD_MAX_AGE_MS,
  advanceBuild,
  forgetBuild,
  isInFlight,
  keepBuild,
  readKeptBuild,
  startFollowing
} from './platformFrameBuild'
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

const NOW = new Date('2026-11-22T10:00:00Z').getTime()

function following(): FollowedBuild {
  return startFollowing(
    started,
    { release_id: 'r-1', release_version: 1 },
    { accountId: 'uid-ana', workspaceId: 'ws-1' }
  )
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  sessionStorage.clear()
})

describe('startFollowing', () => {
  it('remembers the release the deployment ran before the update', () => {
    expect(following()).toEqual({
      kind: 'update',
      buildId: 'b-1',
      accountId: 'uid-ana',
      workspaceId: 'ws-1',
      deploymentId: 'dep-1',
      deploymentName: 'portrait-upscale',
      releaseId: 'r-2',
      version: 2,
      previousReleaseId: 'r-1',
      previousVersion: 1,
      stage: 'building',
      progress: null,
      startedAt: NOW
    })
  })

  it('has no earlier release for a new deployment', () => {
    const build = startFollowing({ ...started, kind: 'new' }, undefined, {
      accountId: 'uid-ana',
      workspaceId: null
    })

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

describe('keeping a build across a reload', () => {
  it('reads back the build it kept, without its progress', () => {
    const build = advanceBuild(following(), {
      type: 'build-progress',
      releaseId: 'r-2',
      step: 2,
      of: 5,
      label: 'Installing nodes'
    })
    keepBuild(build)

    expect(readKeptBuild()).toEqual({ ...build, progress: null })
  })

  it('reads nothing once the build is forgotten', () => {
    keepBuild(following())
    forgetBuild()

    expect(readKeptBuild()).toBeNull()
  })

  it('drops a build kept too long ago', () => {
    keepBuild(following())
    vi.setSystemTime(NOW + KEPT_BUILD_MAX_AGE_MS + 1)

    expect(readKeptBuild()).toBeNull()
    expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
  })

  it.for([
    { label: 'text that is not JSON', raw: '{' },
    { label: 'a failed build', raw: { stage: 'failed' } },
    { label: 'a build with no release', raw: { releaseId: 7 } },
    { label: 'a build kept with no account', raw: { accountId: undefined } }
  ])('drops $label', ({ raw }) => {
    sessionStorage.setItem(
      KEPT_BUILD_KEY,
      typeof raw === 'string'
        ? raw
        : JSON.stringify({
            ...startFollowing(started, undefined, {
              accountId: 'uid-ana',
              workspaceId: null
            }),
            ...raw
          })
    )

    expect(readKeptBuild()).toBeNull()
  })
})
