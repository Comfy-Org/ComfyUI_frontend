import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

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

const noResultsPlaceholderStub = {
  props: ['title', 'buttonLabel'],
  emits: ['action'],
  template: `<div>
    <h3>{{ title }}</h3>
    <button v-if="buttonLabel" @click="$emit('action')">{{ buttonLabel }}</button>
  </div>`
}

const nodePreviewStub = { template: '<div data-testid="node-preview" />' }

describe('NodesTabPanel', () => {
  const renderPanel = (
    nodePack: components['schemas']['Node'],
    nodeNames: string[] = []
  ) =>
    render(NodesTabPanel, {
      props: { nodePack, nodeNames },
      global: {
        plugins: [i18n],
        stubs: {
          NodePreview: nodePreviewStub,
          NoResultsPlaceholder: noResultsPlaceholderStub,
          ProgressSpinner: true
        }
      }
    })

  beforeEach(() => {
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

  it('shows a retryable error placeholder when the fetch fails', async () => {
    getNodeDefs.call.mockResolvedValue(null)

    renderPanel({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    } as components['schemas']['Node'])
    await flushPromises()

    expect(screen.getByText("Couldn't load nodes")).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
    expect(screen.queryByText('No nodes found')).toBeNull()
  })

  it.for([
    ['an explicit empty list', { comfy_nodes: [] }],
    ['an omitted node list', {}]
  ] as const)(
    'shows the empty-pack placeholder for %s',
    async ([, response]) => {
      getNodeDefs.call.mockResolvedValue(response)

      renderPanel({
        id: 'pack-a',
        latest_version: { version: '1.0.0' }
      } as components['schemas']['Node'])
      await flushPromises()

      expect(screen.getByText('No nodes found')).toBeTruthy()
      expect(screen.queryByText('Try again')).toBeNull()
    }
  )

  it('keeps the node-name fallback instead of the error placeholder', async () => {
    getNodeDefs.call.mockResolvedValue(null)

    renderPanel(
      {
        id: 'pack-a',
        latest_version: { version: '1.0.0' }
      } as components['schemas']['Node'],
      ['SomeNode']
    )
    await flushPromises()

    expect(screen.getByText('SomeNode')).toBeTruthy()
    expect(screen.queryByText("Couldn't load nodes")).toBeNull()
  })

  it('busts the cached failure and refetches when retry is clicked', async () => {
    const user = userEvent.setup()
    getNodeDefs.call.mockResolvedValueOnce(null)

    renderPanel({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    } as components['schemas']['Node'])
    await flushPromises()
    const params = getNodeDefs.call.mock.calls[0][0]

    getNodeDefs.call.mockResolvedValue({
      comfy_nodes: [{ comfy_node_name: 'SomeNode', category: 'utils' }]
    })
    await user.click(screen.getByText('Try again'))
    await flushPromises()

    expect(getNodeDefs.clear).toHaveBeenCalledWith(params)
    expect(getNodeDefs.call).toHaveBeenCalledTimes(2)
    expect(screen.queryAllByTestId('node-preview')).toHaveLength(1)
    expect(screen.queryByText("Couldn't load nodes")).toBeNull()
  })

  it('keeps the newest result when two retries for the same pack overlap', async () => {
    let resolveCurrentRetry: (response: unknown) => void = () => {}
    getNodeDefs.call
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCurrentRetry = resolve
          })
      )

    renderPanel({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    } as components['schemas']['Node'])
    await flushPromises()

    // Both clicks land before Vue swaps the button for the spinner, so the two
    // retries share the params object identity the computed keeps handing out.
    const retryButton = screen.getByText('Try again')
    retryButton.click()
    retryButton.click()
    await flushPromises()

    resolveCurrentRetry({
      comfy_nodes: [{ comfy_node_name: 'SomeNode', category: 'utils' }]
    })
    await flushPromises()

    expect(getNodeDefs.call).toHaveBeenCalledTimes(3)
    expect(screen.queryByText("Couldn't load nodes")).toBeNull()
    expect(screen.queryAllByTestId('node-preview')).toHaveLength(1)
  })

  it('does not surface a superseded failure as the new pack failing', async () => {
    let resolveFirst: (response: unknown) => void = () => {}
    getNodeDefs.call.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        })
    )
    getNodeDefs.call.mockResolvedValue({
      comfy_nodes: [{ comfy_node_name: 'SomeNode', category: 'utils' }]
    })

    const nodePack = reactive({
      id: 'pack-a',
      latest_version: { version: '1.0.0' }
    }) as components['schemas']['Node']

    renderPanel(nodePack)
    await flushPromises()

    nodePack.latest_version!.version = '2.0.0'
    await flushPromises()

    resolveFirst(null)
    await flushPromises()

    expect(screen.queryByText("Couldn't load nodes")).toBeNull()
    expect(screen.queryAllByTestId('node-preview')).toHaveLength(1)
  })
})
