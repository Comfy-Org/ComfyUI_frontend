import { render } from '@testing-library/vue'
import type { MenuItem } from 'primevue/menuitem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PropType } from 'vue'
import { defineComponent, nextTick, onMounted, ref } from 'vue'

import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as FormatUtil from '@/utils/formatUtil'

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

vi.mock('@/utils/formatUtil', async (importOriginal) => ({
  ...(await importOriginal<typeof FormatUtil>()),
  isPreviewableMediaType: () => true
}))

const mediaAssetActions = {
  addWorkflow: vi.fn(),
  downloadAssets: vi.fn(),
  openWorkflow: vi.fn(),
  exportWorkflow: vi.fn(),
  copyJobId: vi.fn(),
  deleteAssets: vi.fn().mockResolvedValue(false)
}

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => mediaAssetActions
}))

const capturedMenu = vi.hoisted(() => ({ model: [] as MenuItem[] }))

const contextMenuStub = defineComponent({
  name: 'ContextMenu',
  props: {
    pt: {
      type: Object,
      default: undefined
    },
    model: {
      type: Array as PropType<MenuItem[]>,
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
        capturedMenu.model = items
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

function mountComponent(targetAsset: AssetItem = asset) {
  const onHide = vi.fn()
  const { container, unmount } = render(
    defineComponent({
      components: { MediaAssetContextMenu },
      setup() {
        const menuRef = ref<MediaAssetContextMenuExposed | null>(null)
        onMounted(() => {
          capturedRef = menuRef.value
        })
        return { menuRef, asset: targetAsset, onHide }
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
  capturedMenu.model = []
  document.body.innerHTML = ''
})

type MenuItemWithCommand = MenuItem & {
  command: NonNullable<MenuItem['command']>
}

function findMenuItem(label: string): MenuItem | undefined {
  return capturedMenu.model.find((item) => item.label === label)
}

function findDownloadMenuItem(): MenuItemWithCommand {
  const downloadItem = findMenuItem('mediaAsset.actions.download')
  if (!downloadItem?.command) {
    throw new Error('Download menu item or command was not registered')
  }
  return downloadItem as MenuItemWithCommand
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

  it('shows insert-as-node for assets with a loader node', async () => {
    const { container, unmount } = mountComponent()
    await showMenu(container)

    expect(
      findMenuItem('mediaAsset.actions.insertAsNodeInWorkflow')
    ).toBeDefined()

    unmount()
  })

  it('hides insert-as-node for text assets without a loader node', async () => {
    const { container, unmount } = mountComponent({
      ...asset,
      name: 'result.txt'
    })
    await showMenu(container)

    expect(
      findMenuItem('mediaAsset.actions.insertAsNodeInWorkflow')
    ).toBeUndefined()

    unmount()
  })

  it('routes Download through downloadAssets so multi-output jobs zip', async () => {
    const { container, unmount } = mountComponent()
    await showMenu(container)

    const downloadItem = findDownloadMenuItem()
    downloadItem.command({
      originalEvent: new MouseEvent('click'),
      item: downloadItem
    })

    expect(mediaAssetActions.downloadAssets).toHaveBeenCalledWith([asset])

    unmount()
  })
})
