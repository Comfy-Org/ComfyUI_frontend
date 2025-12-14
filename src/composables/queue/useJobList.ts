import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentNodeName } from '@/composables/queue/useCurrentNodeName'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { isCloud } from '@/platform/distribution/types'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { JobState } from '@/types/queue'
import {
  dateKey,
  formatClockTime,
  formatShortMonthDay,
  isToday,
  isYesterday
} from '@/utils/dateTimeUtil'
import { buildJobDisplay } from '@/utils/queueDisplay'
import { jobStateFromTask } from '@/utils/queueUtil'

/**
 * UI item in the job list. Mirrors data previously prepared inline.
 */
export type JobListItem = {
  id: string
  title: string
  meta: string
  state: JobState
  iconName?: string
  iconImageUrl?: string
  showClear?: boolean
  taskRef?: any
  progressTotalPercent?: number
  progressCurrentPercent?: number
  runningNodeName?: string
  executionTimeMs?: number
  computeHours?: number
}

export type JobGroup = {
  key: string
  label: string
  items: JobListItem[]
}

const ADDED_HINT_DURATION_MS = 3000
const relativeTimeFormatterCache = new Map<string, Intl.RelativeTimeFormat>()
const taskIdToKey = (id: string | number | undefined) => {
  if (id === null || id === undefined) return null
  const key = String(id)
  return key.length ? key : null
}

/**
 * Returns localized Today/Yesterday (capitalized) or localized Mon DD.
 */
const dateLabelForTimestamp = (
  ts: number,
  locale: string,
  relativeFormatter: Intl.RelativeTimeFormat
) => {
  const formatRelativeDay = (value: number) => {
    const formatted = relativeFormatter.format(value, 'day')
    return formatted
      ? formatted[0].toLocaleUpperCase(locale) + formatted.slice(1)
      : formatted
  }
  if (isToday(ts)) {
    return formatRelativeDay(0)
  }
  if (isYesterday(ts)) {
    return formatRelativeDay(-1)
  }
  return formatShortMonthDay(ts, locale)
}

type TaskWithState = {
  task: TaskItemImpl
  state: JobState
}

/**
 * Builds the reactive job list and grouped view for the queue overlay.
 */
export function useJobList() {
  const { t, locale } = useI18n()
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()

  const seenPendingIds = ref<Set<string>>(new Set())
  const recentlyAddedPendingIds = ref<Set<string>>(new Set())
  const addedHintTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  const clearAddedHintTimeout = (id: string) => {
    const timeoutId = addedHintTimeouts.get(id)
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      addedHintTimeouts.delete(id)
    }
  }

  const scheduleAddedHintExpiry = (id: string) => {
    clearAddedHintTimeout(id)
    const timeoutId = setTimeout(() => {
      addedHintTimeouts.delete(id)
      const updated = new Set(recentlyAddedPendingIds.value)
      if (updated.delete(id)) {
        recentlyAddedPendingIds.value = updated
      }
    }, ADDED_HINT_DURATION_MS)
    addedHintTimeouts.set(id, timeoutId)
  }

  watch(
    () =>
      queueStore.pendingTasks
        .map((task) => taskIdToKey(task.promptId))
        .filter((id): id is string => !!id),
    (pendingIds) => {
      const pendingSet = new Set(pendingIds)
      const nextAdded = new Set(recentlyAddedPendingIds.value)
      const nextSeen = new Set(seenPendingIds.value)

      pendingIds.forEach((id) => {
        if (!nextSeen.has(id)) {
          nextSeen.add(id)
          nextAdded.add(id)
          scheduleAddedHintExpiry(id)
        }
      })

      for (const id of Array.from(nextSeen)) {
        if (!pendingSet.has(id)) {
          nextSeen.delete(id)
          nextAdded.delete(id)
          clearAddedHintTimeout(id)
        }
      }

      recentlyAddedPendingIds.value = nextAdded
      seenPendingIds.value = nextSeen
    },
    { immediate: true }
  )

  const shouldShowAddedHint = (task: TaskItemImpl, state: JobState) => {
    if (state !== 'pending') return false
    const id = taskIdToKey(task.promptId)
    if (!id) return false
    return recentlyAddedPendingIds.value.has(id)
  }

  onUnmounted(() => {
    addedHintTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    addedHintTimeouts.clear()
    seenPendingIds.value = new Set<string>()
    recentlyAddedPendingIds.value = new Set<string>()
  })

  const { totalPercent, currentNodePercent } = useQueueProgress()
  const { currentNodeName } = useCurrentNodeName()

  const relativeTimeFormatter = computed(() => {
    const localeValue = locale.value
    let formatter = relativeTimeFormatterCache.get(localeValue)
    if (!formatter) {
      formatter = new Intl.RelativeTimeFormat(localeValue, { numeric: 'auto' })
      relativeTimeFormatterCache.set(localeValue, formatter)
    }
    return formatter
  })
  const undatedLabel = computed(() => t('queue.jobList.undated') || 'Undated')

  const isJobInitializing = (promptId: string | number | undefined) =>
    executionStore.isPromptInitializing(promptId)

  const orderedTasks = computed<TaskItemImpl[]>(() => {
    const all = [
      ...queueStore.pendingTasks,
      ...queueStore.runningTasks,
      ...queueStore.historyTasks
    ]
    return all.sort((a, b) => b.queueIndex - a.queueIndex)
  })

  const tasksWithJobState = computed<TaskWithState[]>(() =>
    orderedTasks.value.map((task) => ({
      task,
      state: jobStateFromTask(task, isJobInitializing(task?.promptId))
    }))
  )

  const jobItems = computed<JobListItem[]>(() => {
    return tasksWithJobState.value.map(({ task, state }) => {
      const isActive =
        String(task.promptId ?? '') ===
        String(executionStore.activePromptId ?? '')
      const showAddedHint = shouldShowAddedHint(task, state)

      const display = buildJobDisplay(task, state, {
        t,
        locale: locale.value,
        formatClockTimeFn: formatClockTime,
        isActive,
        totalPercent: isActive ? totalPercent.value : undefined,
        currentNodePercent: isActive ? currentNodePercent.value : undefined,
        currentNodeName: isActive ? currentNodeName.value : undefined,
        showAddedHint,
        isCloud
      })

      return {
        id: String(task.promptId),
        title: display.primary,
        meta: display.secondary,
        state,
        iconName: display.iconName,
        iconImageUrl: display.iconImageUrl,
        showClear: display.showClear,
        taskRef: task,
        progressTotalPercent:
          state === 'running' && isActive ? totalPercent.value : undefined,
        progressCurrentPercent:
          state === 'running' && isActive
            ? currentNodePercent.value
            : undefined,
        runningNodeName:
          state === 'running' && isActive ? currentNodeName.value : undefined,
        executionTimeMs: task.executionTime,
        computeHours:
          task.executionTime !== undefined
            ? task.executionTime / 3_600_000
            : undefined
      } as JobListItem
    })
  })

  const jobItemById = computed(() => {
    const m = new Map<string, JobListItem>()
    jobItems.value.forEach((ji) => m.set(ji.id, ji))
    return m
  })

  const groupedJobItems = computed<JobGroup[]>(() => {
    const groups: JobGroup[] = []
    const index = new Map<string, number>()
    const localeValue = locale.value
    for (const { task, state } of tasksWithJobState.value) {
      let ts: number | undefined
      if (state === 'completed' || state === 'failed') {
        ts = task.executionEndTimestamp
      } else {
        ts = task.createTime
      }
      const key = ts === undefined ? 'undated' : dateKey(ts)
      let groupIdx = index.get(key)
      if (groupIdx === undefined) {
        const label =
          ts === undefined
            ? undatedLabel.value
            : dateLabelForTimestamp(
                ts,
                localeValue,
                relativeTimeFormatter.value
              )
        groups.push({ key, label, items: [] })
        groupIdx = groups.length - 1
        index.set(key, groupIdx)
      }
      const ji = jobItemById.value.get(String(task.promptId))
      if (ji) groups[groupIdx].items.push(ji)
    }

    return groups
  })

  return {
    orderedTasks,
    jobItems,
    groupedJobItems,
    currentNodeName
  }
}
