import type { JobListItem } from '@comfyorg/api-client/jobTypes'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useReleaseNoticeStore } from '@/platform/workspace/stores/releaseNoticeStore'
import { useQueueStore } from '@/stores/queueStore'
import { createToastId } from '@/types/toastId'

import type { FollowedBuild } from './platformFrameBuild'
import {
  jobsOnRelease,
  noticeBuildFailed,
  noticeBuildReady,
  noticeBuildStarted
} from './platformFrameNotices'

vi.mock(import('@/scripts/api'))

function followed(overrides: Partial<FollowedBuild> = {}): FollowedBuild {
  return {
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
    startedAt: 0,
    ...overrides
  }
}

const FAILURES = [
  ['build-failed', 'Build failed. portrait-upscale was not deployed.'],
  [
    'deploy-failed',
    'Deployment failed. portrait-upscale was built but not deployed.'
  ]
] as const

const NO_RELOAD = { switchTo: async () => {}, reload: null }

function onlyToast() {
  const { toasts } = useToast()
  expect(toasts).toHaveLength(1)
  return toasts[0]
}

function queueJobs(
  running: Partial<JobListItem>[],
  pending: Partial<JobListItem>[] = []
) {
  const queue = useQueueStore()
  queue.runningTasks = fromPartial(running.map((job) => ({ job })))
  queue.pendingTasks = fromPartial(pending.map((job) => ({ job })))
}

describe('jobsOnRelease', () => {
  it('counts running and pending jobs on that release only', () => {
    queueJobs(
      [{ deployment: { release_id: 'r-1' } }, { deployment: null }],
      [
        { deployment: { release_id: 'r-1' } },
        { deployment: { release_id: 'r-2' } },
        {}
      ]
    )

    expect(jobsOnRelease('r-1')).toBe(2)
    expect(jobsOnRelease('r-3')).toBe(0)
  })
})

describe('build notices', () => {
  it('says the build started and the person can keep working', () => {
    noticeBuildStarted(followed(), createToastId())

    expect(onlyToast()).toMatchObject({
      kind: 'info',
      title: 'Building portrait-upscale',
      description: 'This takes a few minutes. You can keep working.'
    })
  })

  it('replaces the earlier notice for the same build', () => {
    const id = createToastId()
    noticeBuildStarted(followed(), id)
    noticeBuildReady(followed(), id, NO_RELOAD)

    expect(onlyToast().kind).toBe('success')
    expect(onlyToast().title).toBe('portrait-upscale now runs v2.')
  })

  it('offers to switch to a new deployment, saying the editor reloads', () => {
    useSettingStore().$patch({
      settingValues: { 'Comfy.Workflow.Persist': true }
    })
    const switchTo = vi.fn()
    noticeBuildReady(
      followed({ kind: 'new', previousReleaseId: null, previousVersion: null }),
      createToastId(),
      { switchTo, reload: null }
    )

    const toast = onlyToast()
    expect(toast).toMatchObject({
      kind: 'success',
      title: 'portrait-upscale is ready',
      description: 'Switching reloads the editor. Your tabs stay open.'
    })
    expect(toast.actions.map((action) => action.label)).toEqual(['Switch'])
    toast.actions[0].onClick()
    expect(switchTo).toHaveBeenCalledOnce()
  })

  it('counts the jobs still finishing on the previous version', () => {
    queueJobs(
      [{ deployment: { release_id: 'r-1' } }],
      [{ deployment: { release_id: 'r-1' } }]
    )

    noticeBuildReady(followed(), createToastId(), NO_RELOAD)

    expect(onlyToast()).toMatchObject({
      kind: 'success',
      title: 'portrait-upscale now runs v2.',
      description: 'Finishing 2 of your jobs on v1.'
    })
  })

  it('says a single job is finishing without a count', () => {
    queueJobs([{ deployment: { release_id: 'r-1' } }])

    noticeBuildReady(followed(), createToastId(), NO_RELOAD)

    expect(onlyToast().description).toBe('Finishing your job on v1.')
  })

  it('leaves the finishing line out when no job runs on the previous version', () => {
    queueJobs([{ deployment: { release_id: 'r-2' } }])

    noticeBuildReady(followed(), createToastId(), NO_RELOAD)

    expect(onlyToast().description).toBeUndefined()
    expect(onlyToast().actions).toEqual([])
  })

  it('offers Reload and Later when the editor runs the updated deployment', () => {
    const reload = vi.fn()
    noticeBuildReady(followed(), createToastId(), {
      switchTo: vi.fn(),
      reload
    })

    const toast = onlyToast()
    expect(toast.title).toBe(
      'portrait-upscale now runs v2. Reload to use its nodes.'
    )
    expect(toast.actions.map((action) => action.label)).toEqual([
      'Reload',
      'Later'
    ])
    toast.actions[0].onClick()
    expect(reload).toHaveBeenCalledOnce()
    toast.actions[1].onClick()
    expect(useToast().toasts).toHaveLength(0)
  })

  it('says the update once when the version notice came first', () => {
    const id = createToastId()
    noticeBuildStarted(followed(), id)
    expect(useReleaseNoticeStore().claim('r-2')).toBe(true)

    noticeBuildReady(followed(), id, NO_RELOAD)

    expect(useToast().toasts).toHaveLength(0)
  })

  it('claims the version so a later version notice stays quiet', () => {
    noticeBuildReady(followed(), createToastId(), NO_RELOAD)

    expect(useReleaseNoticeStore().claim('r-2')).toBe(false)
    expect(useReleaseNoticeStore().claim('r-3')).toBe(true)
  })

  it.for(FAILURES)('titles a %s on a new deployment', ([failed, title]) => {
    noticeBuildFailed(
      followed({ kind: 'new', previousReleaseId: null, previousVersion: null }),
      createToastId(),
      { failed, reason: 'pip install failed' },
      vi.fn()
    )

    expect(onlyToast()).toMatchObject({
      kind: 'error',
      title,
      description: 'pip install failed'
    })
  })

  it.for([
    ['build-failed', 'Nothing changed: portrait-upscale still runs v1.'],
    ['deploy-failed', "portrait-upscale didn't finish updating to v2."]
  ] as const)('titles a %s on an update', ([failed, title]) => {
    const viewDetails = vi.fn()
    noticeBuildFailed(
      followed(),
      createToastId(),
      { failed, reason: '' },
      viewDetails
    )

    const toast = onlyToast()
    expect(toast.title).toBe(title)
    expect(toast.description).toBeUndefined()
    expect(toast.actions.map((action) => action.label)).toEqual([
      'View details'
    ])
    toast.actions[0].onClick()
    expect(viewDetails).toHaveBeenCalledOnce()
  })

  it('leaves the version out when the running one is unknown', () => {
    noticeBuildFailed(
      followed({ previousReleaseId: null, previousVersion: null }),
      createToastId(),
      { failed: 'build-failed', reason: 'timed out' },
      vi.fn()
    )

    expect(onlyToast().title).toBe(
      'Nothing changed: portrait-upscale still runs as before.'
    )
  })
})
