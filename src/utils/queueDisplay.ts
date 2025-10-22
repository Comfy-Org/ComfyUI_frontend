import type { TaskItemImpl } from '@/stores/queueStore'
import type { JobState } from '@/types/queue'
import { clampPercentInt, formatPercent0 } from '@/utils/numberUtil'

type BuildJobDisplayCtx = {
  t: (k: string, v?: Record<string, any>) => string
  locale: string
  firstSeenByPromptId: Record<string, number>
  formatClockTimeFn: (ts: number, locale: string) => string
  isActive: boolean
  totalPercent?: number
  currentNodePercent?: number
  currentNodeName?: string
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
    case 'added':
      return 'icon-[lucide--check]'
    case 'queued':
      return 'icon-[lucide--clock]'
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
  const shortId = String(task.promptId ?? '').split('-')[0]
  const idx = task.queueIndex
  if (typeof idx === 'number') return `${prefix} #${idx}`
  if (shortId) return `${prefix} ${shortId}`
  return prefix
}

const buildQueuedTime = (
  task: TaskItemImpl,
  firstSeenByPromptId: Record<string, number>,
  locale: string,
  formatClockTimeFn: (ts: number, locale: string) => string
): string => {
  const pid = String(task.promptId ?? '')
  const ts = firstSeenByPromptId?.[pid]
  return ts !== undefined ? formatClockTimeFn(ts, locale) : ''
}

export const buildJobDisplay = (
  task: TaskItemImpl,
  state: JobState,
  ctx: BuildJobDisplayCtx
): JobDisplay => {
  if (state === 'added') {
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('queue.jobAddedToQueue'),
      secondary: buildQueuedTime(
        task,
        ctx.firstSeenByPromptId,
        ctx.locale,
        ctx.formatClockTimeFn
      ),
      showClear: true
    }
  }
  if (state === 'queued') {
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('queue.inQueue'),
      secondary: buildQueuedTime(
        task,
        ctx.firstSeenByPromptId,
        ctx.locale,
        ctx.formatClockTimeFn
      ),
      showClear: true
    }
  }
  if (state === 'initialization') {
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('queue.initializingAlmostReady'),
      secondary: buildQueuedTime(
        task,
        ctx.firstSeenByPromptId,
        ctx.locale,
        ctx.formatClockTimeFn
      ),
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
        ? `${ctx.currentNodeName} ${ctx.t(
            'sideToolbar.queueProgressOverlay.colonPercent',
            { percent: curr }
          )}`
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
      preview && preview.isImage ? preview.urlWithTimestamp : undefined
    return {
      iconName: iconForJobState(state),
      iconImageUrl,
      primary:
        preview?.filename && preview.filename.length
          ? preview.filename
          : buildTitle(task, ctx.t),
      secondary: time !== undefined ? `${time.toFixed(2)}s` : '',
      showClear: false
    }
  }
  if (state === 'failed') {
    return {
      iconName: iconForJobState(state),
      primary: ctx.t('g.failed'),
      secondary: ctx.t('g.failed'),
      showClear: true
    }
  }
  return {
    iconName: iconForJobState(state),
    primary: buildTitle(task, ctx.t),
    secondary: '',
    showClear: true
  }
}
