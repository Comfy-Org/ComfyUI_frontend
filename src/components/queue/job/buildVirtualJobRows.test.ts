import { describe, expect, it } from 'vitest'

import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'

import { buildVirtualJobRows } from './buildVirtualJobRows'

function buildJob(id: string): JobListItem {
  return {
    id,
    title: `Job ${id}`,
    meta: 'meta',
    state: 'completed'
  }
}

describe('buildVirtualJobRows', () => {
  it('flattens grouped jobs into headers and rows in display order', () => {
    const displayedJobGroups: JobGroup[] = [
      {
        key: 'today',
        label: 'Today',
        items: [buildJob('job-1'), buildJob('job-2')]
      },
      {
        key: 'yesterday',
        label: 'Yesterday',
        items: [buildJob('job-3')]
      }
    ]

    expect(buildVirtualJobRows(displayedJobGroups)).toEqual([
      {
        key: 'header-today',
        type: 'header',
        label: 'Today'
      },
      {
        key: 'job-job-1',
        type: 'job',
        job: displayedJobGroups[0].items[0]
      },
      {
        key: 'job-job-2',
        type: 'job',
        job: displayedJobGroups[0].items[1]
      },
      {
        key: 'header-yesterday',
        type: 'header',
        label: 'Yesterday'
      },
      {
        key: 'job-job-3',
        type: 'job',
        job: displayedJobGroups[1].items[0]
      }
    ])
  })

  it('keeps a single group flattened without extra row metadata', () => {
    const displayedJobGroups: JobGroup[] = [
      {
        key: 'today',
        label: 'Today',
        items: [buildJob('job-1')]
      }
    ]

    expect(buildVirtualJobRows(displayedJobGroups)).toEqual([
      {
        key: 'header-today',
        type: 'header',
        label: 'Today'
      },
      {
        key: 'job-job-1',
        type: 'job',
        job: displayedJobGroups[0].items[0]
      }
    ])
  })
})
