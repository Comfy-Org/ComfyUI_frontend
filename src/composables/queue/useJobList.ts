import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { st } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
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
const dateLabelForTimestamp = (ts: number, locale: string) => {
  if (isToday(ts)) {
    const s = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      0,
      'day'
    )
    return s ? s[0].toLocaleUpperCase(locale) + s.slice(1) : s
  }
  if (isYesterday(ts)) {
    const s = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -1,
      'day'
    )
    return s ? s[0].toLocaleUpperCase(locale) + s.slice(1) : s
  }
  return formatShortMonthDay(ts, locale)
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

  const allTasksSorted = computed(() => {
    const all = [
      ...queueStore.pendingTasks,
      ...queueStore.runningTasks,
      ...queueStore.historyTasks
    ]
    return all.sort((a, b) => b.queueIndex - a.queueIndex)
  })

  const filteredTasks = computed(() => {
    let tasks = allTasksSorted.value
    if (selectedJobTab.value === 'Completed') {
      tasks = tasks.filter(
        (t) =>
          jobStateFromTask(t, isJobInitializing(t?.promptId)) === 'completed'
      )
    } else if (selectedJobTab.value === 'Failed') {
      tasks = tasks.filter(
        (t) => jobStateFromTask(t, isJobInitializing(t?.promptId)) === 'failed'
      )
    }

    if (selectedWorkflowFilter.value === 'current') {
      const activeId = workflowStore.activeWorkflow?.activeState?.id
      if (!activeId) return []
      tasks = tasks.filter((t: any) => {
        const wid = t.workflow?.id
        return !!wid && wid === activeId
      })
    }
    return tasks
  })

  const jobItems = computed<JobListItem[]>(() => {
    return filteredTasks.value.map((task: any) => {
      const state = jobStateFromTask(task, isJobInitializing(task?.promptId))
      const isActive =
        String(task.promptId ?? '') ===
        String(executionStore.activePromptId ?? '')

      const display = buildJobDisplay(task, state, {
        t,
        locale: locale.value,
        firstSeenByPromptId: queueStore.hideFirstSeenByPromptIdUI
          ? {}
          : queueStore.firstSeenByPromptId,
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
    for (const task of filteredTasks.value) {
      const state = jobStateFromTask(task, isJobInitializing(task?.promptId))
      const pid = String(task.promptId ?? '')
      let ts: number | undefined
      if (state === 'completed' || state === 'failed') {
        ts = task.executionEndTimestamp
      } else {
        ts = queueStore.firstSeenByPromptId?.[pid]
      }
      const effectiveTs = ts ?? Date.now()
      const key = dateKey(effectiveTs)
      let groupIdx = index.get(key)
      if (groupIdx === undefined) {
        groups.push({
          key,
          label: dateLabelForTimestamp(effectiveTs, locale.value),
          items: []
        })
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
