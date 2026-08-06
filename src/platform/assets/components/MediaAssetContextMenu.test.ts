import { render } from '@testing-library/vue'
import type { MenuItem } from 'primevue/menuitem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropType } from 'vue'
import { defineComponent, nextTick, onMounted, ref } from 'vue'

import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import type * as FormatUtil from '@/utils/formatUtil'

const mockGetServerFeature = vi.spyOn(api, 'getServerFeature')

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
  openAssetLocation: vi.fn(),
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

function mountComponent(
  targetAsset: AssetItem = asset,
  assetType: 'input' | 'output' = 'output'
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
        return { menuRef, asset: targetAsset, assetType, onHide }
      },
      template:
        '<MediaAssetContextMenu ref="menuRef" :asset="asset" :asset-type="assetType" :show-delete-button="true" file-kind="image" @hide="onHide" />'
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

beforeEach(() => {
  mockGetServerFeature.mockReturnValue(true)
})

afterEach(() => {
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

  it('hides Copy Job ID for persistent outputs without provenance', async () => {
    const { container, unmount } = mountComponent({
      ...asset,
      tags: ['output'],
      loader_path: 'video/old-output.mp4'
    })
    await showMenu(container)

    expect(findMenuItem('mediaAsset.actions.copyJobId')).toBeUndefined()

    unmount()
  })

  it('shows Copy Job ID for persistent outputs with provenance', async () => {
    const { container, unmount } = mountComponent({
      ...asset,
      tags: ['output'],
      loader_path: 'video/new-output.mp4',
      job_id: 'prompt-123'
    })
    await showMenu(container)

    expect(findMenuItem('mediaAsset.actions.copyJobId')).toBeDefined()

    unmount()
  })

  it('puts local input deletion directly after download', async () => {
    const { container, unmount } = mountComponent(asset, 'input')
    await showMenu(container)

    const downloadIndex = capturedMenu.model.findIndex(
      (item) => item.label === 'mediaAsset.actions.download'
    )
    const deleteIndex = capturedMenu.model.findIndex(
      (item) => item.label === 'mediaAsset.actions.delete'
    )
    expect(deleteIndex).toBe(downloadIndex + 1)

    const deleteItem = findMenuItem('mediaAsset.actions.delete')
    if (!deleteItem?.command) throw new Error('Delete command is missing')
    await deleteItem.command({
      originalEvent: new MouseEvent('click'),
      item: deleteItem
    })
    expect(mediaAssetActions.deleteAssets).toHaveBeenCalledWith(asset, {
      skipConfirmation: true
    })

    unmount()
  })

  it('hides local input deletion when the asset API is disabled', async () => {
    mockGetServerFeature.mockReturnValue(false)
    const { container, unmount } = mountComponent(asset, 'input')
    await showMenu(container)

    expect(findMenuItem('mediaAsset.actions.delete')).toBeUndefined()

    unmount()
  })

  it('orders local generated file actions after download', async () => {
    const persistentOutput = {
      ...asset,
      tags: ['output'],
      loader_path: 'video/render.mp4'
    }
    const { container, unmount } = mountComponent(persistentOutput)
    await showMenu(container)

    const labels = capturedMenu.model.map((item) => item.label)
    const downloadIndex = labels.indexOf('mediaAsset.actions.download')
    expect(labels.slice(downloadIndex, downloadIndex + 4)).toEqual([
      'mediaAsset.actions.download',
      'mediaAsset.actions.openFileLocation',
      'mediaAsset.actions.delete',
      'mediaAsset.actions.deleteSourceFile'
    ])

    const openLocationItem = findMenuItem('mediaAsset.actions.openFileLocation')
    if (!openLocationItem?.command) {
      throw new Error('Open-location command is missing')
    }
    openLocationItem.command({
      originalEvent: new MouseEvent('click'),
      item: openLocationItem
    })
    expect(mediaAssetActions.openAssetLocation).toHaveBeenCalledWith(
      persistentOutput
    )

    mediaAssetActions.deleteAssets.mockResolvedValueOnce(true)
    const deleteItem = findMenuItem('mediaAsset.actions.delete')
    if (!deleteItem?.command) throw new Error('Delete command is missing')
    await deleteItem.command({
      originalEvent: new MouseEvent('click'),
      item: deleteItem
    })
    expect(mediaAssetActions.deleteAssets).toHaveBeenLastCalledWith(
      persistentOutput,
      { skipConfirmation: true }
    )

    mediaAssetActions.deleteAssets.mockResolvedValueOnce(true)
    const deleteSourceItem = findMenuItem('mediaAsset.actions.deleteSourceFile')
    if (!deleteSourceItem?.command) {
      throw new Error('Delete-source command is missing')
    }
    await deleteSourceItem.command({
      originalEvent: new MouseEvent('click'),
      item: deleteSourceItem
    })
    expect(mediaAssetActions.deleteAssets).toHaveBeenLastCalledWith(
      persistentOutput,
      { deleteContent: true }
    )

    unmount()
  })
})
