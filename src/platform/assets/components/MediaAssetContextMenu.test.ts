import { render } from '@testing-library/vue'
import type { MenuItem } from 'primevue/menuitem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PropType } from 'vue'
import { defineComponent, nextTick, onMounted, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as FormatUtil from '@/utils/formatUtil'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

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
  deleteAssets: vi.fn().mockResolvedValue(false),
  shareAssets: vi.fn().mockResolvedValue(true),
  unshareAssets: vi.fn()
}

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => mediaAssetActions
}))

const sharingMock = vi.hoisted(() => ({
  shared: new Set<string>(),
  teammateOwned: new Set<string>(),
  canShare: true
}))
vi.mock('../composables/useAssetSharing', () => ({
  useAssetSharing: () => ({
    isShared: (id: string) => sharingMock.shared.has(id),
    canShare: (id: string) =>
      sharingMock.canShare && !sharingMock.teammateOwned.has(id)
  })
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

function mountComponent(
  targetAsset: AssetItem = asset,
  selectedAssets?: AssetItem[]
) {
  const onHide = vi.fn()
  const { container, unmount } = render(
    defineComponent({
      components: { MediaAssetContextMenu },
      setup() {
        const menuRef = ref<MediaAssetContextMenuExposed | null>(null)
        onMounted(() => {
          capturedRef = menuRef.value
        })
        return { menuRef, asset: targetAsset, selectedAssets, onHide }
      },
      template:
        '<MediaAssetContextMenu ref="menuRef" :asset="asset" asset-type="output" file-kind="image" :selected-assets="selectedAssets" :is-bulk-mode="!!selectedAssets" @hide="onHide" />'
    }),
    {
      global: {
        plugins: [i18n],
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
  sharingMock.shared.clear()
  sharingMock.teammateOwned.clear()
  sharingMock.canShare = true
  document.body.innerHTML = ''
})

type MenuItemWithCommand = MenuItem & {
  command: NonNullable<MenuItem['command']>
}

function findMenuItem(label: string): MenuItem | undefined {
  return capturedMenu.model.find((item) => item.label === label)
}

function findDownloadMenuItem(): MenuItemWithCommand {
  const downloadItem = findMenuItem('Download')
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

    expect(findMenuItem('Insert as node in workflow')).toBeDefined()

    unmount()
  })

  it('hides insert-as-node for text assets without a loader node', async () => {
    const { container, unmount } = mountComponent({
      ...asset,
      name: 'result.txt'
    })
    await showMenu(container)

    expect(findMenuItem('Insert as node in workflow')).toBeUndefined()

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

  it("omits the Share item for an asset you can't share (teammate's)", async () => {
    sharingMock.canShare = false
    const { container, unmount } = mountComponent()
    await showMenu(container)

    const shareItem = capturedMenu.model.find(
      (item) => item.label === 'Share with team'
    )
    expect(shareItem).toBeUndefined()

    unmount()
  })

  it('shows a Share item that routes to shareAssets', async () => {
    const { container, unmount } = mountComponent()
    await showMenu(container)

    const shareItem = capturedMenu.model.find(
      (item) => item.label === 'Share with team'
    ) as MenuItemWithCommand | undefined
    expect(shareItem).toBeDefined()

    shareItem!.command({
      originalEvent: new MouseEvent('click'),
      item: shareItem!
    })
    expect(mediaAssetActions.shareAssets).toHaveBeenCalledWith([asset])

    unmount()
  })

  it('shows an Unshare item routing to unshareAssets for a shared asset', async () => {
    sharingMock.shared.add(asset.id)
    const { container, unmount } = mountComponent()
    await showMenu(container)

    const unshareItem = capturedMenu.model.find(
      (item) => item.label === 'Make private'
    ) as MenuItemWithCommand | undefined
    expect(unshareItem).toBeDefined()

    unshareItem!.command({
      originalEvent: new MouseEvent('click'),
      item: unshareItem!
    })
    expect(mediaAssetActions.unshareAssets).toHaveBeenCalledWith([asset])

    unmount()
  })

  describe('bulk selection', () => {
    const selection: AssetItem[] = [
      asset,
      { ...asset, id: 'asset-2', name: 'other.png' },
      { ...asset, id: 'teammates', name: 'theirs.png' }
    ]

    it("bulk Share all only targets assets you own (not teammates')", async () => {
      sharingMock.teammateOwned.add('teammates')
      const { container, unmount } = mountComponent(asset, selection)
      await showMenu(container)

      const shareAll = capturedMenu.model.find(
        (item) => item.label === 'Share all'
      ) as MenuItemWithCommand | undefined
      expect(shareAll).toBeDefined()

      shareAll!.command({
        originalEvent: new MouseEvent('click'),
        item: shareAll!
      })
      expect(mediaAssetActions.shareAssets).toHaveBeenCalledWith([
        selection[0],
        selection[1]
      ])

      unmount()
    })

    it('offers Make all private when every owned asset is already shared', async () => {
      sharingMock.teammateOwned.add('teammates')
      sharingMock.shared.add(asset.id)
      sharingMock.shared.add('asset-2')
      const { container, unmount } = mountComponent(asset, selection)
      await showMenu(container)

      const unshareAll = capturedMenu.model.find(
        (item) => item.label === 'Make all private'
      ) as MenuItemWithCommand | undefined
      expect(unshareAll).toBeDefined()

      unshareAll!.command({
        originalEvent: new MouseEvent('click'),
        item: unshareAll!
      })
      expect(mediaAssetActions.unshareAssets).toHaveBeenCalledWith([
        selection[0],
        selection[1]
      ])

      unmount()
    })

    it('omits the bulk share item when every selected asset is a teammate’s', async () => {
      for (const item of selection) sharingMock.teammateOwned.add(item.id)
      const { container, unmount } = mountComponent(asset, selection)
      await showMenu(container)

      const labels = capturedMenu.model.map((item) => item.label)
      expect(labels).not.toContain('Share all')
      expect(labels).not.toContain('Make all private')

      unmount()
    })
  })
})
