import { render } from '@testing-library/vue'
import type { MenuItem } from 'primevue/menuitem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onMounted, ref } from 'vue'

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

let capturedModel: MenuItem[] = []

const contextMenuStub = defineComponent({
  name: 'ContextMenu',
  props: {
    pt: {
      type: Object,
      default: undefined
    },
    model: {
      type: Array as () => MenuItem[],
      default: () => []
    }
  },
  emits: ['hide'],
  data() {
    return {
      visible: false
    }
  },
  watch: {
    model: {
      immediate: true,
      handler(items: MenuItem[]) {
        capturedModel = items
      }
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

interface MediaAssetContextMenuExposed {
  show: (event: MouseEvent) => void
}

let capturedRef: MediaAssetContextMenuExposed | null = null

function mountComponent() {
  const onHide = vi.fn()
  const { container, unmount } = render(
    defineComponent({
      components: { MediaAssetContextMenu },
      setup() {
        const menuRef = ref<MediaAssetContextMenuExposed | null>(null)
        onMounted(() => {
          capturedRef = menuRef.value
        })
        return { menuRef, asset, onHide }
      },
      template:
        '<MediaAssetContextMenu ref="menuRef" :asset="asset" asset-type="output" file-kind="image" @hide="onHide" />'
    }),
    {
      global: {
        stubs: {
          ContextMenu: contextMenuStub,
          Button: buttonStub
        }
      }
    }
  )
  return { container, unmount, onHide }
}

async function showMenu(container: Element): Promise<HTMLElement> {
  const event = new MouseEvent('contextmenu', { bubbles: true })
  capturedRef!.show(event)
  await nextTick()
  // eslint-disable-next-line testing-library/no-container
  return container.querySelector('.context-menu-stub') as HTMLElement
}

afterEach(() => {
  vi.clearAllMocks()
  capturedRef = null
  capturedModel = []
  document.body.innerHTML = ''
})

type MenuCommand = NonNullable<MenuItem['command']>

function findDownloadCommand(): MenuCommand {
  const downloadItem = capturedModel.find(
    (item) => item.label === 'mediaAsset.actions.download'
  )
  if (!downloadItem?.command) {
    throw new Error('Download menu item or command was not registered')
  }
  return downloadItem.command
}

describe('MediaAssetContextMenu', () => {
  it('dismisses outside pointerdown using the rendered root id', async () => {
    const { container, unmount, onHide } = mountComponent()
    const outside = document.createElement('div')
    document.body.append(outside)

    const menu = await showMenu(container)
    const menuId = menu.id

    expect(menuId).not.toBe('')
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.getElementById(menuId)).toBe(menu)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.context-menu-stub')).toBeNull()
    expect(onHide).toHaveBeenCalledOnce()

    unmount()
  })

  it('routes Download through downloadMultipleAssets so multi-output jobs zip', async () => {
    const { container, unmount } = mountComponent()
    await showMenu(container)

    const command = findDownloadCommand()
    command({ originalEvent: new Event('click'), item: {} })

    expect(mediaAssetActions.downloadMultipleAssets).toHaveBeenCalledWith([
      asset
    ])
    expect(mediaAssetActions.downloadAsset).not.toHaveBeenCalled()

    unmount()
  })
})
