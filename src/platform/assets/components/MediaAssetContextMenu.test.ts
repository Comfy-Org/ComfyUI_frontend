import { mount } from '@vue/test-utils'
import type { MenuItem } from 'primevue/menuitem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'

import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/workflow/utils/workflowExtractionUtil', () => ({
  supportsWorkflowMetadata: () => true
}))

vi.mock('@/utils/formatUtil', () => ({
  isPreviewableMediaType: () => true
}))

vi.mock('@/utils/loaderNodeUtil', () => ({
  detectNodeTypeFromFilename: () => ({ nodeType: 'LoadImage' })
}))

const mediaAssetActions = {
  addWorkflow: vi.fn(),
  downloadAsset: vi.fn(),
  downloadMultipleAssets: vi.fn(),
  openWorkflow: vi.fn(),
  exportWorkflow: vi.fn(),
  copyJobId: vi.fn(),
  deleteAssets: vi.fn().mockResolvedValue(false)
}

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => mediaAssetActions
}))

const contextMenuStub = defineComponent({
  name: 'ContextMenu',
  props: {
    pt: {
      type: Object,
      default: undefined
    },
    model: {
      type: Array,
      default: () => []
    }
  },
  emits: ['hide'],
  data() {
    return {
      visible: false
    }
  },
  methods: {
    show() {
      this.visible = true
    },
    hide() {
      this.visible = false
      this.$emit('hide')
    }
  },
  template: `
    <div
      v-if="visible"
      class="context-menu-stub"
      v-bind="pt?.root"
    />
  `
})

const asset: AssetItem = {
  id: 'asset-1',
  name: 'image.png',
  tags: [],
  user_metadata: {}
}

const buttonStub = {
  template: '<div class="button-stub"><slot /></div>'
}

type MediaAssetContextMenuExposed = ComponentPublicInstance & {
  show: (event: MouseEvent) => void
}

const mountComponent = () =>
  mount(MediaAssetContextMenu, {
    attachTo: document.body,
    props: {
      asset,
      assetType: 'output',
      fileKind: 'image'
    },
    global: {
      stubs: {
        ContextMenu: contextMenuStub,
        Button: buttonStub
      }
    }
  })

async function showMenu(
  wrapper: ReturnType<typeof mountComponent>
): Promise<HTMLElement> {
  const exposed = wrapper.vm as MediaAssetContextMenuExposed
  const event = new MouseEvent('contextmenu', { bubbles: true })
  exposed.show(event)
  await nextTick()

  return wrapper.get('.context-menu-stub').element as HTMLElement
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('MediaAssetContextMenu', () => {
  it('dismisses outside pointerdown using the rendered root id', async () => {
    const wrapper = mountComponent()
    const outside = document.createElement('div')
    document.body.append(outside)

    const menu = await showMenu(wrapper)
    const menuId = menu.id

    expect(menuId).not.toBe('')
    expect(document.getElementById(menuId)).toBe(menu)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('.context-menu-stub').exists()).toBe(false)
    expect(wrapper.emitted('hide')).toEqual([[]])

    wrapper.unmount()
  })

  it('routes Download through downloadMultipleAssets so multi-output jobs zip', async () => {
    const wrapper = mountComponent()
    await showMenu(wrapper)

    const menu = wrapper.findComponent(contextMenuStub)
    const items = menu.props('model') as MenuItem[]
    const download = items.find(
      (item) => item.label === 'mediaAsset.actions.download'
    )

    expect(download?.command).toBeTypeOf('function')
    download?.command?.({ originalEvent: new Event('click'), item: download })

    expect(mediaAssetActions.downloadMultipleAssets).toHaveBeenCalledWith([
      asset
    ])
    expect(mediaAssetActions.downloadAsset).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
