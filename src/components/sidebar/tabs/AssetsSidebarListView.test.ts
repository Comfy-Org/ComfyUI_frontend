import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AssetsSidebarListView from './AssetsSidebarListView.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    isAssetDeleting: () => false
  })
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
  })

  const defaultProps = {
    assetItems: [],
    selectableAssets: [],
    isSelected: () => false,
    isStackExpanded: () => false,
    toggleStack: async () => {}
  }

  it('renders without errors with empty assets', () => {
    const wrapper = mount(AssetsSidebarListView, {
      props: defaultProps,
      shallow: true
    })

    expect(wrapper.exists()).toBe(true)
    const listItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    expect(listItems).toHaveLength(0)
  })
})
