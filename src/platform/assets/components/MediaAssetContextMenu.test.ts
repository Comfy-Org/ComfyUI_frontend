import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onMounted, ref } from 'vue'

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
  downloadAssets: vi.fn(),
  openWorkflow: vi.fn(),
  exportWorkflow: vi.fn(),
  copyJobId: vi.fn(),
  deleteAssets: vi.fn().mockResolvedValue(false)
}

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => mediaAssetActions
}))

const asset: AssetItem = {
  id: 'asset-1',
  name: 'image.png',
  tags: [],
  user_metadata: {}
}

interface MediaAssetContextMenuExposed {
  show: (event: MouseEvent) => void
}

let capturedRef: MediaAssetContextMenuExposed | null = null

function mountComponent() {
  const onHide = vi.fn()
  const { unmount } = render(
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
    })
  )
  return { unmount, onHide }
}

async function openMenu() {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    clientX: 0,
    clientY: 0
  })
  capturedRef!.show(event)
  return await screen.findByRole('menu')
}

afterEach(() => {
  vi.clearAllMocks()
  capturedRef = null
  document.body.innerHTML = ''
})

describe('MediaAssetContextMenu', () => {
  it('emits hide when menu closes', async () => {
    const user = userEvent.setup()
    const { unmount, onHide } = mountComponent()

    await openMenu()
    await user.keyboard('{Escape}')

    expect(onHide).toHaveBeenCalled()

    unmount()
  })

  it('routes Download through downloadAssets', async () => {
    const user = userEvent.setup()
    const { unmount } = mountComponent()

    await openMenu()
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'mediaAsset.actions.download'
      })
    )

    expect(mediaAssetActions.downloadAssets).toHaveBeenCalledWith([asset])

    unmount()
  })
})
