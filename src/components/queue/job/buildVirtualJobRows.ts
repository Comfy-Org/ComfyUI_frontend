import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'

const HEADER_ROW_HEIGHT = 20
const GROUP_ROW_GAP = 16
export const JOB_ROW_HEIGHT = 48
export const VIRTUAL_JOB_LIST_BOTTOM_PADDING = 16

export type VirtualJobRow =
  | {
      key: string
      type: 'header'
      label: string
      height: number
    }
  | {
      key: string
      type: 'job'
      job: JobListItem
      height: number
    }

export function buildVirtualJobRows(
  displayedJobGroups: JobGroup[]
): VirtualJobRow[] {
  const rows: VirtualJobRow[] = []
  const lastGroupIndex = displayedJobGroups.length - 1

  displayedJobGroups.forEach((group, groupIndex) => {
    rows.push({
      key: `header-${group.key}`,
      type: 'header',
      label: group.label,
      height: HEADER_ROW_HEIGHT
    })

    group.items.forEach((job, jobIndex) => {
      const isLastJobInGroup = jobIndex === group.items.length - 1
      const isLastGroup = groupIndex === lastGroupIndex

      rows.push({
        key: `job-${job.id}`,
        type: 'job',
        job,
        height:
          JOB_ROW_HEIGHT +
          (isLastJobInGroup && !isLastGroup ? GROUP_ROW_GAP : 0)
      })
    })
  })

  return rows
}
