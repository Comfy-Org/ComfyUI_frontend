import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import { render } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { components } from '@/types/comfyRegistryTypes'

import InfoPanelMultiItem from './InfoPanelMultiItem.vue'

const getNodeDefs = vi.hoisted(() => ({
  call: vi.fn(),
  cancel: vi.fn(),
  clear: vi.fn()
}))

vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: () => ({ getNodeDefs })
}))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({
    updatePack: { call: vi.fn(), clear: vi.fn() }
  })
}))

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/usePacksSelection',
  () => ({
    usePacksSelection: () => ({
      installedPacks: computed(() => []),
      notInstalledPacks: computed(() => []),
      isAllInstalled: computed(() => false),
      isNoneInstalled: computed(() => true),
      isMixed: computed(() => false),
      nightlyPacks: computed(() => []),
      hasNightlyPacks: computed(() => false)
    })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/usePacksStatus',
  () => ({
    usePacksStatus: () => ({
      hasImportFailed: computed(() => false),
      overallStatus: computed(() => 'installed')
    })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      checkNodeCompatibility: () => ({ hasConflict: false, conflicts: [] })
    })
  })
)

const flushPromises = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('InfoPanelMultiItem', () => {
  const renderPanel = (nodePacks: components['schemas']['Node'][]) =>
    render(InfoPanelMultiItem, {
      props: { nodePacks },
      global: {
        plugins: [i18n],
        stubs: {
          Button: true,
          DotSpinner: true,
          ModelInfoField: true,
          PackInstallButton: true,
          PackStatusMessage: true,
          PackUninstallButton: true,
          PropertiesAccordionItem: true
        },
        directives: { tooltip: {} }
      }
    })

  beforeEach(() => {
    getNodeDefs.call.mockImplementation(() => new Promise(() => {}))
  })

  it('cancels the params it actually issued when a pack version changes mid-flight', async () => {
    const nodePack = reactive({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    }) as components['schemas']['Node']

    const { unmount } = renderPanel([nodePack])
    await flushPromises()
    const issuedParams = getNodeDefs.call.mock.calls[0][0]

    nodePack.latest_version!.version = '2.0.0'
    await flushPromises()

    unmount()

    expect(getNodeDefs.cancel).toHaveBeenCalledTimes(1)
    expect(getNodeDefs.cancel).toHaveBeenCalledWith(issuedParams)
  })

  it('does not cancel requests that already settled', async () => {
    getNodeDefs.call.mockResolvedValue({ comfy_nodes: [] })

    const nodePack = {
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    } as components['schemas']['Node']

    const { unmount } = renderPanel([nodePack])
    await flushPromises()

    unmount()

    expect(getNodeDefs.cancel).not.toHaveBeenCalled()
  })
})
