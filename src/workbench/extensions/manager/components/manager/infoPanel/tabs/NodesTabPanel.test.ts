import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import { render } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { components } from '@/types/comfyRegistryTypes'

import NodesTabPanel from './NodesTabPanel.vue'

const getNodeDefs = vi.hoisted(() => ({
  call: vi.fn(),
  cancel: vi.fn(),
  clear: vi.fn()
}))

vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: () => ({ getNodeDefs })
}))

const flushPromises = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('NodesTabPanel', () => {
  const renderPanel = (nodePack: components['schemas']['Node']) =>
    render(NodesTabPanel, {
      props: { nodePack, nodeNames: [] },
      global: {
        plugins: [i18n],
        stubs: {
          NodePreview: true,
          NoResultsPlaceholder: true,
          ProgressSpinner: true
        }
      }
    })

  beforeEach(() => {
    vi.clearAllMocks()
    getNodeDefs.call.mockResolvedValue({ comfy_nodes: [] })
  })

  it('does not refetch when an unrelated field of the pack changes', async () => {
    const nodePack = reactive({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    }) as components['schemas']['Node']

    renderPanel(nodePack)
    await flushPromises()
    expect(getNodeDefs.call).toHaveBeenCalledTimes(1)

    nodePack.downloads = 42
    if (nodePack.latest_version) nodePack.latest_version.deprecated = true
    await flushPromises()

    expect(getNodeDefs.call).toHaveBeenCalledTimes(1)
  })

  it('refetches on a version change, cancelling only its own in-flight request', async () => {
    let resolveFirst: (response: unknown) => void = () => {}
    getNodeDefs.call.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        })
    )

    const nodePack = reactive({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    }) as components['schemas']['Node']

    renderPanel(nodePack)
    await flushPromises()
    const firstParams = getNodeDefs.call.mock.calls[0][0]

    nodePack.latest_version!.version = '2.0.0'
    await flushPromises()

    expect(getNodeDefs.call).toHaveBeenCalledTimes(2)
    expect(getNodeDefs.cancel).toHaveBeenCalledTimes(1)
    expect(getNodeDefs.cancel).toHaveBeenCalledWith(firstParams)

    resolveFirst({ comfy_nodes: [] })
  })

  it('cancels its in-flight request on unmount', async () => {
    getNodeDefs.call.mockImplementationOnce(() => new Promise(() => {}))

    const nodePack = reactive({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    }) as components['schemas']['Node']

    const { unmount } = renderPanel(nodePack)
    await flushPromises()
    const params = getNodeDefs.call.mock.calls[0][0]

    unmount()

    expect(getNodeDefs.cancel).toHaveBeenCalledWith(params)
  })
})
