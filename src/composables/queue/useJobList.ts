import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { st } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
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
import { normalizeI18nKey } from '@/utils/formatUtil'
import { buildJobDisplay } from '@/utils/queueDisplay'
import { jobStateFromTask } from '@/utils/queueUtil'

/** Tabs for job list filtering */
export const jobTabs = ['All', 'Completed', 'Failed'] as const
type JobTab = (typeof jobTabs)[number]

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
}

type JobGroup = {
  key: string
  label: string
  items: JobListItem[]
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
 * Builds the reactive job list, filters, and grouped view for the queue overlay.
 */
export function useJobList() {
  const { t, locale } = useI18n()
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()

  const { totalPercent, currentNodePercent } = useQueueProgress()

  const relativeTimeFormatter = computed(
    () => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  )
  const undatedLabel = computed(() => t('queue.jobList.undated') || 'Undated')

  const isJobInitializing = (promptId: string | number | undefined) =>
    executionStore.isPromptInitializing(promptId)

  const currentNodeName = computed(() => {
    const node = executionStore.executingNode
    if (!node) return t('g.emDash')
    const title = (node.title ?? '').toString().trim()
    if (title) return title
    const nodeType = (node.type ?? '').toString().trim() || t('g.untitled')
    const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
    return st(key, nodeType)
  })

  const selectedJobTab = ref<JobTab>('All')
  const selectedWorkflowFilter = ref<'all' | 'current'>('all')

  const allTasksSorted = computed<TaskItemImpl[]>(() => {
    const all = [
      ...queueStore.pendingTasks,
      ...queueStore.runningTasks,
      ...queueStore.historyTasks
    ]
    return all.sort((a, b) => b.queueIndex - a.queueIndex)
  })

  const tasksWithJobState = computed<TaskWithState[]>(() =>
    allTasksSorted.value.map((task) => ({
      task,
      state: jobStateFromTask(task, isJobInitializing(task?.promptId))
    }))
  )

  const filteredTaskEntries = computed<TaskWithState[]>(() => {
    let entries = tasksWithJobState.value
    if (selectedJobTab.value === 'Completed') {
      entries = entries.filter(({ state }) => state === 'completed')
    } else if (selectedJobTab.value === 'Failed') {
      entries = entries.filter(({ state }) => state === 'failed')
    }

    if (selectedWorkflowFilter.value === 'current') {
      const activeId = workflowStore.activeWorkflow?.activeState?.id
      if (!activeId) return []
      entries = entries.filter(({ task }) => {
        const wid = task.workflow?.id
        return !!wid && wid === activeId
      })
    }
    return entries
  })

  const filteredTasks = computed<TaskItemImpl[]>(() =>
    filteredTaskEntries.value.map(({ task }) => task)
  )

  const jobItems = computed<JobListItem[]>(() => {
    return filteredTaskEntries.value.map(({ task, state }) => {
      const isActive =
        String(task.promptId ?? '') ===
        String(executionStore.activePromptId ?? '')

      const display = buildJobDisplay(task, state, {
        t,
        locale: locale.value,
        formatClockTimeFn: formatClockTime,
        isActive,
        totalPercent: isActive ? totalPercent.value : undefined,
        currentNodePercent: isActive ? currentNodePercent.value : undefined,
        currentNodeName: isActive ? currentNodeName.value : undefined
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
          state === 'running' && isActive ? currentNodeName.value : undefined
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
    for (const { task, state } of filteredTaskEntries.value) {
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
    // filters/state
    selectedJobTab,
    selectedWorkflowFilter,
    // data sources
    allTasksSorted,
    filteredTasks,
    jobItems,
    groupedJobItems,
    currentNodeName
  }
}
