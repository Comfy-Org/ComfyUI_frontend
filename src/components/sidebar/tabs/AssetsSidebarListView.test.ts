import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'

import AssetsSidebarListView from './AssetsSidebarListView.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/queue/useJobActions', () => ({
  useJobActions: () => ({
    cancelAction: { variant: 'ghost', label: 'Cancel', icon: 'pi pi-times' },
    canCancelJob: ref(false),
    runCancelJob: vi.fn()
  })
}))

const mockJobItems = ref<
  Array<{
    id: string
    title: string
    meta: string
    state: string
    createTime?: number
  }>
>([])

vi.mock('@/composables/queue/useJobList', () => ({
  useJobList: () => ({
    jobItems: mockJobItems
  })
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    isAssetDeleting: () => false
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => key === 'Comfy.Queue.QPOV2'
  })
}))

vi.mock('@/utils/queueUtil', () => ({
  isActiveJobState: (state: string) =>
    state === 'pending' || state === 'running'
}))

vi.mock('@/utils/queueDisplay', () => ({
  iconForJobState: () => 'pi pi-spinner'
}))

vi.mock('@/platform/assets/schemas/assetMetadataSchema', () => ({
  getOutputAssetMetadata: () => undefined
}))

vi.mock('@/platform/assets/utils/mediaIconUtil', () => ({
  iconForMediaType: () => 'pi pi-file'
}))

vi.mock('@/utils/formatUtil', () => ({
  formatDuration: (d: number) => `${d}s`,
  formatSize: (s: number) => `${s}B`,
  getMediaTypeFromFilename: () => 'image',
  truncateFilename: (name: string) => name
}))

describe('AssetsSidebarListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobItems.value = []
  })

  const defaultProps = {
    assetItems: [],
    selectableAssets: [],
    isSelected: () => false,
    isStackExpanded: () => false,
    toggleStack: async () => {}
  }

  it('displays active jobs in oldest-first order (FIFO)', () => {
    mockJobItems.value = [
      {
        id: 'newest',
        title: 'Newest Job',
        meta: '',
        state: 'pending',
        createTime: 3000
      },
      {
        id: 'middle',
        title: 'Middle Job',
        meta: '',
        state: 'running',
        createTime: 2000
      },
      {
        id: 'oldest',
        title: 'Oldest Job',
        meta: '',
        state: 'pending',
        createTime: 1000
      }
    ]

    const wrapper = mount(AssetsSidebarListView, {
      props: defaultProps,
      shallow: true
    })

    const jobListItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    expect(jobListItems).toHaveLength(3)

    const displayedTitles = jobListItems.map((item) =>
      item.props('primaryText')
    )
    expect(displayedTitles).toEqual(['Oldest Job', 'Middle Job', 'Newest Job'])
  })

  it('excludes completed and failed jobs from active jobs section', () => {
    mockJobItems.value = [
      { id: 'pending', title: 'Pending', meta: '', state: 'pending' },
      { id: 'completed', title: 'Completed', meta: '', state: 'completed' },
      { id: 'failed', title: 'Failed', meta: '', state: 'failed' },
      { id: 'running', title: 'Running', meta: '', state: 'running' }
    ]

    const wrapper = mount(AssetsSidebarListView, {
      props: defaultProps,
      shallow: true
    })

    const jobListItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    expect(jobListItems).toHaveLength(2)

    const displayedTitles = jobListItems.map((item) =>
      item.props('primaryText')
    )
    expect(displayedTitles).toContain('Running')
    expect(displayedTitles).toContain('Pending')
    expect(displayedTitles).not.toContain('Completed')
    expect(displayedTitles).not.toContain('Failed')
  })
})
