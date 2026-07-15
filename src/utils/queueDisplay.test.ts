import { describe, expect, it } from 'vitest'

import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { JobState } from '@/types/queue'
import type { BuildJobDisplayCtx } from '@/utils/queueDisplay'
import { buildJobDisplay, iconForJobState } from '@/utils/queueDisplay'

type QueueDisplayTask = Parameters<typeof buildJobDisplay>[0]
type PreviewOutput = NonNullable<QueueDisplayTask['previewOutput']>

function createJob(
  status: JobListItem['status'],
  overrides: Partial<JobListItem> = {}
): JobListItem {
  return {
    id: 'job-123456',
    status,
    create_time: 1_710_000_000_000,
    priority: 12,
    ...overrides
  }
}

function createTask({
  job,
  jobId = 'job-123456',
  createTime = 1_710_000_000_000,
  executionTime,
  executionTimeInSeconds,
  previewOutput
}: {
  job?: Partial<JobListItem>
  jobId?: string
  createTime?: number
  executionTime?: number
  executionTimeInSeconds?: number
  previewOutput?: PreviewOutput
} = {}): QueueDisplayTask {
  return {
    job: createJob(job?.status ?? 'pending', job),
    jobId,
    createTime,
    executionTime,
    executionTimeInSeconds,
    previewOutput
  } as QueueDisplayTask
}

function createCtx(
  overrides: Partial<BuildJobDisplayCtx> = {}
): BuildJobDisplayCtx {
  return {
    t: (key, values) => {
      const entries = Object.entries(values ?? {})
      if (!entries.length) return key

      return `${key}(${entries
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')})`
    },
    locale: 'en-US',
    formatClockTimeFn: (ts, locale) => `${locale}:${ts}`,
    isActive: false,
    ...overrides
  }
}

describe('iconForJobState', () => {
  it.for<[JobState, string]>([
    ['pending', 'icon-[lucide--loader-circle]'],
    ['initialization', 'icon-[lucide--server-crash]'],
    ['running', 'icon-[lucide--zap]'],
    ['completed', 'icon-[lucide--check-check]'],
    ['failed', 'icon-[lucide--alert-circle]']
  ])('maps %s to its icon', ([state, icon]) => {
    expect(iconForJobState(state)).toBe(icon)
  })
})

describe('buildJobDisplay', () => {
  it('shows the added hint for pending jobs when requested', () => {
    expect(
      buildJobDisplay(
        createTask(),
        'pending',
        createCtx({ showAddedHint: true })
      )
    ).toEqual({
      iconName: 'icon-[lucide--check]',
      primary: 'queue.jobAddedToQueue',
      secondary: 'en-US:1710000000000',
      showClear: true
    })
  })

  it('shows queued time for pending and initializing jobs', () => {
    expect(buildJobDisplay(createTask(), 'pending', createCtx())).toMatchObject(
      {
        iconName: 'icon-[lucide--loader-circle]',
        primary: 'queue.inQueue',
        secondary: 'en-US:1710000000000',
        showClear: true
      }
    )

    expect(
      buildJobDisplay(createTask(), 'initialization', createCtx())
    ).toMatchObject({
      iconName: 'icon-[lucide--server-crash]',
      primary: 'queue.initializingAlmostReady',
      secondary: 'en-US:1710000000000',
      showClear: true
    })
  })

  it('formats active running progress from the injected context', () => {
    expect(
      buildJobDisplay(
        createTask({ job: { status: 'in_progress' } }),
        'running',
        createCtx({
          isActive: true,
          totalPercent: 42.7,
          currentNodePercent: -10,
          currentNodeName: 'KSampler'
        })
      )
    ).toEqual({
      iconName: 'icon-[lucide--zap]',
      primary: 'sideToolbar.queueProgressOverlay.total(percent=43%)',
      secondary:
        'KSampler sideToolbar.queueProgressOverlay.colonPercent(percent=0%)',
      showClear: true
    })
  })

  it('uses a compact running label when the job is not active', () => {
    expect(
      buildJobDisplay(
        createTask({ job: { status: 'in_progress' } }),
        'running',
        createCtx()
      )
    ).toEqual({
      iconName: 'icon-[lucide--zap]',
      primary: 'g.running',
      secondary: '',
      showClear: true
    })
  })

  it('shows local completed jobs as the preview filename', () => {
    expect(
      buildJobDisplay(
        createTask({
          job: {
            status: 'completed'
          },
          executionTimeInSeconds: 3.51,
          previewOutput: {
            filename: 'preview.png',
            isImage: true,
            url: '/api/view?filename=preview.png&type=output&subfolder='
          } as PreviewOutput
        }),
        'completed',
        createCtx()
      )
    ).toEqual({
      iconName: 'icon-[lucide--check-check]',
      iconImageUrl: '/api/view?filename=preview.png&type=output&subfolder=',
      primary: 'preview.png',
      secondary: '3.51s',
      showClear: false
    })
  })

  it('shows cloud completed jobs as elapsed time', () => {
    expect(
      buildJobDisplay(
        createTask({
          job: {
            status: 'completed'
          },
          executionTime: 64_000,
          executionTimeInSeconds: 64
        }),
        'completed',
        createCtx({ isCloud: true })
      )
    ).toMatchObject({
      iconName: 'icon-[lucide--check-check]',
      primary: 'queue.completedIn(duration=1m 4s)',
      secondary: '64.00s',
      showClear: false
    })
  })

  it('falls back to job title for completed jobs without a preview filename', () => {
    expect(
      buildJobDisplay(
        createTask({
          job: {
            status: 'completed',
            priority: 42
          }
        }),
        'completed',
        createCtx()
      )
    ).toMatchObject({
      iconName: 'icon-[lucide--check-check]',
      primary: 'g.job #42',
      secondary: '',
      showClear: false
    })
  })

  it('shows failed jobs as clearable failures', () => {
    expect(buildJobDisplay(createTask(), 'failed', createCtx())).toEqual({
      iconName: 'icon-[lucide--alert-circle]',
      primary: 'g.failed',
      secondary: 'g.failed',
      showClear: true
    })
  })
})
