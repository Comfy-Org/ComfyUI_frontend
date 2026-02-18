import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const actionMocks = vi.hoisted(() => ({
  addWorkflow: vi.fn(),
  copyJobId: vi.fn(),
  deleteAssets: vi.fn(),
  downloadAsset: vi.fn(),
  exportWorkflow: vi.fn(),
  openWorkflow: vi.fn()
}))

vi.mock('primevue/contextmenu', () => ({
  default: {
    name: 'ContextMenu',
    props: ['model', 'pt'],
    emits: ['hide'],
    template: '<div data-testid="context-menu" />'
  }
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/platform/assets/composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => actionMocks
}))

type MenuItemLike = {
  label?: string
  command?: () => void
}

function createAsset(name: string): AssetItem {
  return {
    id: 'asset-1',
    name,
    tags: []
  }
}

describe('MediaAssetContextMenu', () => {
  it('includes inspect action for 3D assets and emits zoom when triggered', () => {
    const wrapper = mount(MediaAssetContextMenu, {
      props: {
        asset: createAsset('model.glb'),
        assetType: 'output'
      }
    })

    const model = wrapper
      .findComponent({ name: 'ContextMenu' })
      .props('model') as MenuItemLike[]
    const inspectItem = model.find(
      (item) => item.label === 'mediaAsset.actions.inspect'
    )

    expect(inspectItem).toBeDefined()
    inspectItem?.command?.()
    expect(wrapper.emitted('zoom')).toHaveLength(1)
  })
})
