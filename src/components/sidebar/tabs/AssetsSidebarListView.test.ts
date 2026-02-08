import { mount } from '@vue/test-utils'
import { computed } from 'vue'
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

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    isAssetDeleting: () => false
  })
}))

vi.mock('@/composables/queue/useJobActions', () => ({
  useJobActions: () => ({
    cancelAction: {
      icon: 'icon-[lucide--x]',
      label: 'Cancel',
      variant: 'destructive'
    },
    canCancelJob: computed(() => true),
    runCancelJob: vi.fn()
  })
}))

import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'

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

const AssetsListItemStub = {
  name: 'AssetsListItem',
  emits: ['contextmenu'],
  template:
    '<div class="assets-list-item-stub" @contextmenu="$emit(\'contextmenu\', $event)"><slot name="actions" /></div>'
}

const createJobItem = (overrides: Partial<JobListItem> = {}): JobListItem => ({
  id: 'job-1',
  title: 'Active job',
  meta: 'In progress',
  state: 'running',
  ...overrides
})

describe('AssetsSidebarListView', () => {
  beforeEach(() => {
    jobItems.splice(0, jobItems.length)
    settingGetMock.mockReset()
    settingGetMock.mockReturnValue(true)
  })

  it('emits job context menu for active jobs in QPOV2 list mode', async () => {
    const activeJob = createJobItem()
    jobItems.push(activeJob)

    const wrapper = mount(AssetsSidebarListView, {
      props: {
        assets: [],
        isSelected: () => false
      },
      global: {
        plugins: [i18n],
        stubs: {
          VirtualGrid: VirtualGridStub,
          AssetsListItem: AssetsListItemStub,
          Button: true,
          LoadingOverlay: true
        }
      }
    })

    wrapper
      .findComponent(AssetsListItemStub)
      .vm.$emit('contextmenu', new MouseEvent('contextmenu'))

    expect(wrapper.emitted('job-context-menu')).toHaveLength(1)
    expect(wrapper.emitted('job-context-menu')?.[0]?.[1]).toEqual(activeJob)
  })
})
