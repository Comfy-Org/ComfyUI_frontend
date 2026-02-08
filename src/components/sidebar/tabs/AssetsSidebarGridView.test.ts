import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { JobListItem } from '@/composables/queue/useJobList'

const { jobItems, settingGetMock } = vi.hoisted(() => ({
  jobItems: [] as JobListItem[],
  settingGetMock: vi.fn()
}))

vi.mock('@/composables/queue/useJobList', () => ({
  useJobList: () => ({
    jobItems: {
      get value() {
        return jobItems
      }
    }
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: settingGetMock
  })
}))

vi.mock('@/platform/assets/components/MediaAssetCard.vue', () => ({
  default: {
    name: 'MediaAssetCard',
    template: '<div class="media-asset-card-stub" />'
  }
}))

vi.mock('@/platform/assets/components/ActiveMediaAssetCard.vue', () => ({
  default: {
    name: 'ActiveMediaAssetCard',
    emits: ['context-menu'],
    template:
      '<div class="active-media-asset-card-stub" @contextmenu="$emit(\'context-menu\', $event)" />'
  }
}))

import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const VirtualGridStub = {
  name: 'VirtualGrid',
  props: {
    items: { type: Array, required: true }
  },
  template:
    '<div><div v-for="item in items" :key="item.key"><slot name="item" :item="item" /></div></div>'
}

const createJobItem = (overrides: Partial<JobListItem> = {}): JobListItem => ({
  id: 'job-1',
  title: 'Active job',
  meta: 'In progress',
  state: 'running',
  ...overrides
})

describe('AssetsSidebarGridView', () => {
  beforeEach(() => {
    jobItems.splice(0, jobItems.length)
    settingGetMock.mockReset()
    settingGetMock.mockReturnValue(true)
  })

  it('emits job context menu for active job cards in QPOV2', async () => {
    const activeJob = createJobItem()
    jobItems.push(activeJob)

    const wrapper = mount(AssetsSidebarGridView, {
      props: {
        assets: [],
        isSelected: () => false,
        showOutputCount: () => false,
        getOutputCount: () => 0
      },
      global: {
        plugins: [i18n],
        stubs: {
          VirtualGrid: VirtualGridStub
        }
      }
    })

    await wrapper.get('.active-media-asset-card-stub').trigger('contextmenu')

    expect(wrapper.emitted('job-context-menu')).toHaveLength(1)
    expect(wrapper.emitted('job-context-menu')?.[0]?.[1]).toEqual(activeJob)
  })
})
