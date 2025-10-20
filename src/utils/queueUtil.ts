import type { TaskItemImpl } from '@/stores/queueStore'
import type { JobState } from '@/types/queue'

/**
 * Map a task to a UI job state, including initialization override.
 *
 * @param task Task item from the queue store
 * @param isInitializing True if the prompt is currently initializing
 * @returns JobState for UI
 */
export const jobStateFromTask = (
  task: TaskItemImpl,
  isInitializing: boolean
): JobState => {
  if (isInitializing) return 'initialization'
  const status = task.displayStatus
  switch (status) {
    case 'Running':
      return 'running'
    case 'Pending':
      return 'queued'
    case 'Completed':
      return 'completed'
    case 'Failed':
    case 'Cancelled':
      return 'failed'
  }
  return 'queued'
}

/**
 * Return icon class for a given job state.
 *
 * @param state Job state
 * @returns Icon class name
 */
export const iconForJobState = (state: JobState): string => {
  switch (state) {
    case 'added':
      return 'icon-[lucide--plus]'
    case 'queued':
      return 'icon-[lucide--clock]'
    case 'initialization':
      return 'icon-[lucide--server-crash]'
    case 'running':
      return 'icon-[lucide--zap]'
    case 'completed':
      return 'icon-[lucide--check]'
    case 'failed':
      return 'icon-[lucide--alert-circle]'
    default:
      return 'icon-[lucide--circle]'
  }
}

/**
 * Determine if the clear action should be shown for a job state.
 *
 * @param state Job state
 * @param override Optional override from props
 * @returns True if clear action should be visible
 */
export const shouldShowClear = (
  state: JobState,
  override?: boolean
): boolean => {
  if (override !== undefined) return override
  return state === 'queued' || state === 'failed' || state === 'added'
}

/**
 * Build a display title for a task.
 *
 * @param task Task item
 * @param t i18n translate function
 * @returns Title string
 */
export const buildJobTitle = (
  task: TaskItemImpl,
  t: (k: string) => string
): string => {
  const prefix = t('g.job')
  const shortId = String(task.promptId ?? '').split('-')[0]
  const idx = task.queueIndex
  if (typeof idx === 'number') return `${prefix} #${idx}`
  if (shortId) return `${prefix} ${shortId}`
  return prefix
}

/**
 * Build the right-side meta text for a task depending on state.
 *
 * @param task Task item
 * @param state Job state
 * @param firstSeenByPromptId Map from promptId to first-seen timestamp
 * @param locale BCP-47 locale string
 * @param t i18n translate function
 * @param formatClockTimeFn Localized clock formatter
 * @returns Meta string for the UI
 */
export const buildJobMeta = (
  task: TaskItemImpl,
  state: JobState,
  firstSeenByPromptId: Record<string, number>,
  locale: string,
  t: (k: string) => string,
  formatClockTimeFn: (ts: number, locale: string) => string
): string => {
  if (state === 'running') return t('g.running')
  if (state === 'queued' || state === 'initialization' || state === 'added') {
    const pid = String(task.promptId ?? '')
    const ts = firstSeenByPromptId?.[pid]
    return ts !== undefined ? formatClockTimeFn(ts, locale) : ''
  }
  if (state === 'completed') {
    const time = task.executionTimeInSeconds
    return time !== undefined ? `${time.toFixed(2)}s` : ''
  }
  if (state === 'failed') return t('g.failed')
  return ''
}
