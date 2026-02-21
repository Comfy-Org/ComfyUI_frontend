import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'

import JobAssetsList from './JobAssetsList.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const buildJob = (overrides: Partial<JobListItem> = {}): JobListItem => ({
  id: 'job-1',
  title: 'Job 1',
  meta: 'meta',
  state: 'completed',
  iconImageUrl: '/api/view/job-1.png',
  ...overrides
})

const mountJobAssetsList = (jobs: JobListItem[]) => {
  const displayedJobGroups: JobGroup[] = [
    {
      key: 'group-1',
      label: 'Group 1',
      items: jobs
    }
  ]

  return mount(JobAssetsList, {
    props: { displayedJobGroups }
  })
}

describe('JobAssetsList', () => {
  it('emits viewItem on preview-click for completed jobs with preview', async () => {
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    listItem.vm.$emit('preview-click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('emits viewItem on double-click for completed jobs with preview', async () => {
    const job = buildJob()
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    await listItem.trigger('dblclick')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toEqual([[job]])
  })

  it('does not emit viewItem on double-click for non-completed jobs', async () => {
    const job = buildJob({ state: 'running' })
    const wrapper = mountJobAssetsList([job])

    const listItem = wrapper.findComponent({ name: 'AssetsListItem' })
    await listItem.trigger('dblclick')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('viewItem')).toBeUndefined()
  })
})
