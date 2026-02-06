import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'

import QueueAssetView from './QueueAssetView.vue'

const mockJobItems = ref<JobListItem[]>([])

vi.mock('@/composables/queue/useJobList', () => ({
  useJobList: () => ({
    jobItems: mockJobItems
  })
}))

vi.mock('@/composables/queue/useJobActions', () => ({
  useJobActions: () => ({
    cancelAction: { variant: 'ghost', label: 'Cancel', icon: 'pi pi-times' },
    canCancelJob: ref(false),
    runCancelJob: vi.fn()
  })
}))

vi.mock('@/utils/queueUtil', () => ({
  isActiveJobState: (state: string) =>
    state === 'pending' || state === 'running' || state === 'initialization'
}))

vi.mock('@/utils/queueDisplay', () => ({
  iconForJobState: () => 'pi pi-spinner'
}))

function makeJob(overrides: Partial<JobListItem>): JobListItem {
  return {
    id: 'job-1',
    title: 'Job 1',
    meta: '',
    state: 'pending',
    ...overrides
  }
}

describe('QueueAssetView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobItems.value = []
  })

  it('displays active jobs in oldest-first order (FIFO)', () => {
    mockJobItems.value = [
      makeJob({ id: 'newest', title: 'Newest Job', state: 'pending' }),
      makeJob({ id: 'middle', title: 'Middle Job', state: 'running' }),
      makeJob({ id: 'oldest', title: 'Oldest Job', state: 'pending' })
    ]

    const wrapper = mount(QueueAssetView, {
      props: { viewMode: 'list' },
      shallow: true
    })

    const items = wrapper.findAllComponents({ name: 'AssetsListItem' })
    expect(items).toHaveLength(3)

    const titles = items.map((item) => item.props('primaryText'))
    expect(titles).toEqual(['Oldest Job', 'Middle Job', 'Newest Job'])
  })

  it('excludes completed and failed jobs', () => {
    mockJobItems.value = [
      makeJob({ id: 'pending', title: 'Pending', state: 'pending' }),
      makeJob({ id: 'completed', title: 'Completed', state: 'completed' }),
      makeJob({ id: 'failed', title: 'Failed', state: 'failed' }),
      makeJob({ id: 'running', title: 'Running', state: 'running' })
    ]

    const wrapper = mount(QueueAssetView, {
      props: { viewMode: 'list' },
      shallow: true
    })

    const items = wrapper.findAllComponents({ name: 'AssetsListItem' })
    expect(items).toHaveLength(2)

    const titles = items.map((item) => item.props('primaryText'))
    expect(titles).toContain('Running')
    expect(titles).toContain('Pending')
    expect(titles).not.toContain('Completed')
    expect(titles).not.toContain('Failed')
  })
})
