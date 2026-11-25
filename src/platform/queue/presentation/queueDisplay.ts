import type { JobModelDownload } from '@/platform/queue/stores/jobModelDownloadStore'
import type { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import { resultItemUrl } from '@/utils/resultItemUrl'
import { isImageResult } from '@comfyorg/api-client/results/resultItem'
import { formatDuration, formatSize } from '@/utils/formatUtil'
import { clampPercentInt, formatPercent0 } from '@/utils/numberUtil'
export type BuildJobDisplayCtx = {
  t: (k: string, v?: Record<string, unknown>) => string
  locale: string
  formatClockTimeFn: (ts: number, locale: string) => string
  isActive: boolean
  totalPercent?: number
  currentNodePercent?: number
  currentNodeName?: string
  showAddedHint?: boolean
  isCloud?: boolean
  modelDownload?: Omit<JobModelDownload, 'progress'>
}
type JobDisplay = {
  iconName: string
  iconImageUrl?: string
  primary: string
  secondary: string
  showClear: boolean
}
export const iconForJobState = (state: JobState): string => {
  switch (state) {
    case 'pending':
      return 'icon-[lucide--loader-circle]'
    case 'initialization':
      return 'icon-[lucide--server-crash]'
    case 'running':
      return 'icon-[lucide--zap]'
    case 'completed':
      return 'icon-[lucide--check-check]'
    case 'failed':
      return 'icon-[lucide--alert-circle]'
    default:
      return 'icon-[lucide--circle]'
  }
}
const buildTitle = (task: TaskItemImpl, t: (k: string) => string): string => {
  const prefix = t('g.job')
  const shortId = task.jobId.split('-')[0]
  const idx = task.job.priority
  if (typeof idx === 'number') return `${prefix} #${idx}`
  if (shortId) return `${prefix} ${shortId}`
  return prefix
}
const buildQueuedTime = (
  task: TaskItemImpl,
  locale: string,
  formatClockTimeFn: (ts: number, locale: string) => string
): string => {
  const ts = task.createTime
  return formatClockTimeFn(ts, locale)
}
export const buildJobDisplay = (
  task: TaskItemImpl,
  state: JobState,
  ctx: BuildJobDisplayCtx
): JobDisplay => {
  if (ctx.modelDownload) {
    const { name, index, count, bytesDownloaded, bytesTotal } =
      ctx.modelDownload
    return {
      iconName: 'icon-[lucide--download]',
      primary:
        count > 1
          ? ctx.t('queue.downloadingModelOf', { name, index, count })
          : ctx.t('queue.downloadingModel', { name }),
      secondary:
        bytesTotal === null
          ? formatSize(bytesDownloaded)
          : ctx.t('queue.downloadedOfTotal', {
              downloaded: formatSize(bytesDownloaded),
              total: formatSize(bytesTotal)
            }),
      showClear: true
    }
  }
  if (state === 'pending') {
    if (ctx.showAddedHint) {
      return {
        iconName: 'icon-[lucide--check]',
        primary: ctx.t('queue.jobAddedToQueue'),
        secondary: buildQueuedTime(task, ctx.locale, ctx.formatClockTimeFn),
        showClear: true
      }
    }
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('queue.inQueue'),
      secondary: buildQueuedTime(task, ctx.locale, ctx.formatClockTimeFn),
      showClear: true
    }
  }
  if (state === 'initialization') {
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('queue.initializingAlmostReady'),
      secondary: buildQueuedTime(task, ctx.locale, ctx.formatClockTimeFn),
      showClear: true
    }
  }
  if (state === 'running') {
    if (ctx.isActive) {
      const total = formatPercent0(
        ctx.locale,
        clampPercentInt(ctx.totalPercent)
      )
      const curr = formatPercent0(
        ctx.locale,
        clampPercentInt(ctx.currentNodePercent)
      )
      const primary = ctx.t('sideToolbar.queueProgressOverlay.total', {
        percent: total
      })
      const right = ctx.currentNodeName
        ? `${ctx.currentNodeName} ${ctx.t('sideToolbar.queueProgressOverlay.colonPercent', { percent: curr })}`
        : ''
      return {
        iconName: iconForJobState(state),
        primary,
        secondary: right,
        showClear: true
      }
    }
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('g.running'),
      secondary: '',
      showClear: true
    }
  }
  if (state === 'completed') {
    const time = task.executionTimeInSeconds
    const preview = task.previewOutput
    const iconImageUrl =
      preview && isImageResult(preview) ? resultItemUrl(preview) : undefined
    const primary = ctx.isCloud
      ? ctx.t('queue.completedIn', {
          duration: formatDuration(task.executionTime ?? 0)
        })
      : preview?.filename && preview.filename.length
        ? preview.filename
        : buildTitle(task, ctx.t)
    return {
      iconName: iconForJobState(state),
      iconImageUrl,
      primary,
      secondary: time !== undefined ? `${time.toFixed(2)}s` : '',
      showClear: false
    }
  }
  return {
    iconName: iconForJobState(state),
    primary: ctx.t('g.failed'),
    secondary: ctx.t('g.failed'),
    showClear: true
  }
}
export type JobState =
  | 'pending'
  | 'initialization'
  | 'running'
  | 'completed'
  | 'failed'
export const jobSortModes = ['mostRecent', 'totalGenerationTime'] as const
export type JobSortMode = (typeof jobSortModes)[number]
export type JobListItem = {
  id: string
  title: string
  meta: string
  state: JobState
  iconName?: string
  iconImageUrl?: string
  showClear?: boolean
  taskRef?: TaskItemImpl
  progressTotalPercent?: number
  progressCurrentPercent?: number
  runningNodeName?: string
  isFocused?: boolean
  canFocus?: boolean
  executionTimeMs?: number
  computeHours?: number
}
export type JobGroup = {
  key: string
  label: string
  items: JobListItem[]
}
export function isActiveJobState(state: JobState): boolean {
  return (
    state === 'pending' || state === 'initialization' || state === 'running'
  )
}
export const jobStateFromTask = (
  task: TaskItemImpl,
  { isInitializing = false }: { isInitializing?: boolean } = {}
): JobState => {
  if (isInitializing) return 'initialization'
  const status = task.displayStatus
  switch (status) {
    case 'Running':
      return 'running'
    case 'Pending':
      return 'pending'
    case 'Completed':
      return 'completed'
    case 'Failed':
    case 'Cancelled':
      return 'failed'
  }
  return 'failed'
}
