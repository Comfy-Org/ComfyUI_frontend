import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

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

const buttonStub = {
  template: '<button class="button-stub" type="button"><slot /></button>'
}

const mountComponent = () =>
  mount(MediaAssetContextMenu, {
    attachTo: document.body,
    props: {
      asset,
      assetType: 'output',
      fileKind: 'image'
    },
    slots: {
      default: '<button class="context-trigger" type="button">Trigger</button>'
    },
    global: {
      stubs: {
        Button: buttonStub
      }
    }
  })

async function showMenu(): Promise<HTMLElement | null> {
  const trigger = document.body.querySelector('.context-trigger')
  trigger?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
  )
  await waitForMenuUpdate()

  return document.body.querySelector(
    '.media-asset-context-menu-content'
  ) as HTMLElement | null
}

const waitForMenuUpdate = async () => {
  await nextTick()
  await nextTick()
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('MediaAssetContextMenu', () => {
  it('opens from the slotted context-menu trigger', async () => {
    const wrapper = mountComponent()

    const menu = await showMenu()
    expect(menu).not.toBeNull()
    wrapper.unmount()
  })

  it('forwards inspect actions from the menu panel', async () => {
    const wrapper = mountComponent()

    const menu = await showMenu()
    expect(menu).not.toBeNull()

    const inspectButton = document.body.querySelector(
      '.media-asset-context-menu-content .button-stub'
    ) as HTMLButtonElement | null
    inspectButton?.click()
    await waitForMenuUpdate()

    expect(wrapper.emitted('zoom')).toEqual([[]])
    wrapper.unmount()
  })

  it('closes on scroll', async () => {
    const wrapper = mountComponent()

    const menu = await showMenu()
    expect(menu).not.toBeNull()

    window.dispatchEvent(new Event('scroll'))
    await waitForMenuUpdate()

    expect(
      document.body.querySelector('.media-asset-context-menu-content')
    ).toBeNull()

    wrapper.unmount()
  })
})
