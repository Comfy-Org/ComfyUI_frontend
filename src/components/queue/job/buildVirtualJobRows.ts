import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'

export type VirtualJobRow =
  | {
      key: string
      type: 'header'
      label: string
    }
  | {
      key: string
      type: 'job'
      job: JobListItem
    }

export function buildVirtualJobRows(
  displayedJobGroups: JobGroup[]
): VirtualJobRow[] {
  const rows: VirtualJobRow[] = []

  displayedJobGroups.forEach((group) => {
    rows.push({
      key: `header-${group.key}`,
      type: 'header',
      label: group.label
    })

    group.items.forEach((job) => {
      rows.push({
        key: `job-${job.id}`,
        type: 'job',
        job
      })
    })
  })

  return rows
}
