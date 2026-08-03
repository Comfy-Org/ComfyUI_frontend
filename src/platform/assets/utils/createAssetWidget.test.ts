import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetAssetOptions
} from '@/lib/litegraph/src/types/widgets'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { createAssetWidget } from './createAssetWidget'

vi.mock('@/platform/assets/composables/useAssetBrowserDialog', () => {
  const show = vi.fn()
  const browse = vi.fn()
  return {
    useAssetBrowserDialog: () => ({ show, browse })
  }
})

interface HostAssetWidget extends IBaseWidget<
  string,
  'asset',
  IWidgetAssetOptions
> {
  node: LGraphNode
}

type OnWidgetChanged = NonNullable<LGraphNode['onWidgetChanged']>

function checkpointAsset(name: string): AssetItem {
  return {
    id: `asset-${name}`,
    name,
    hash: 'checkpoint-hash',
    mime_type: 'application/octet-stream',
    tags: []
  }
}

function createAssetWidgetNode() {
  const node = new LGraphNode('TestNode')
  const onWidgetChanged = vi.fn<OnWidgetChanged>()
  node.onWidgetChanged = onWidgetChanged

  return { node, onWidgetChanged }
}

function assertAssetOptions(
  options: unknown
): asserts options is IWidgetAssetOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('Expected asset widget options')
  }
  if (!('openModal' in options) || typeof options.openModal !== 'function') {
    throw new Error('Expected asset widget options')
  }
}

function firstShowOptions() {
  const showOptions = vi.mocked(useAssetBrowserDialog().show).mock.calls[0]?.[0]
  if (!showOptions) {
    throw new Error('Expected the asset browser dialog to open')
  }
  return showOptions
}

describe('createAssetWidget', () => {
  let captureCanvasState: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()
    captureCanvasState = vi.fn()
    setActivePinia(
      createTestingPinia({
        stubActions: false,
        initialState: {
          workflow: {
            activeWorkflow: {
              changeTracker: { captureCanvasState }
            }
          }
        }
      })
    )
  })

  it('preserves regular asset widget change handling for the owning widget', async () => {
    const { node, onWidgetChanged } = createAssetWidgetNode()
    const widget = createAssetWidget({
      node,
      widgetName: 'ckpt_name',
      nodeTypeForBrowser: 'CheckpointLoaderSimple',
      inputNameForBrowser: 'ckpt_name',
      defaultValue: 'fake_model.safetensors'
    })

    assertAssetOptions(widget.options)
    await widget.options.openModal(widget)
    const showOptions = firstShowOptions()

    expect(showOptions).toMatchObject({
      nodeType: 'CheckpointLoaderSimple',
      inputName: 'ckpt_name',
      currentValue: 'fake_model.safetensors'
    })

    showOptions.onAssetSelected?.(checkpointAsset('real_model.safetensors'))

    expect(widget.value).toBe('real_model.safetensors')
    expect(onWidgetChanged).toHaveBeenCalledWith(
      'ckpt_name',
      'real_model.safetensors',
      'fake_model.safetensors',
      widget
    )
    expect(captureCanvasState).toHaveBeenCalledOnce()
  })

  it('commits cloned asset modal selections through the promoted host widget', async () => {
    const { node, onWidgetChanged: sourceOnWidgetChanged } =
      createAssetWidgetNode()
    const sourceWidget = createAssetWidget({
      node,
      widgetName: 'ckpt_name',
      nodeTypeForBrowser: 'CheckpointLoaderSimple',
      inputNameForBrowser: 'ckpt_name',
      defaultValue: 'fake_model.safetensors'
    })
    assertAssetOptions(sourceWidget.options)
    const hostCallback = vi.fn<NonNullable<IBaseWidget['callback']>>()
    const hostNode = new LGraphNode('PromotedHostNode')
    const hostOnWidgetChanged = vi.fn<OnWidgetChanged>()
    hostNode.onWidgetChanged = hostOnWidgetChanged
    const hostWidget: HostAssetWidget = {
      type: 'asset',
      name: 'host_ckpt_name',
      value: 'fake_model.safetensors',
      callback: hostCallback,
      options: sourceWidget.options,
      node: hostNode,
      y: 0
    }

    await sourceWidget.options.openModal(hostWidget)
    const showOptions = firstShowOptions()

    expect(showOptions).toMatchObject({
      nodeType: 'CheckpointLoaderSimple',
      inputName: 'ckpt_name',
      currentValue: 'fake_model.safetensors'
    })

    showOptions.onAssetSelected?.(checkpointAsset('real_model.safetensors'))

    expect(sourceOnWidgetChanged).not.toHaveBeenCalled()
    expect(hostWidget.value).toBe('real_model.safetensors')
    expect(hostCallback).toHaveBeenCalledWith('real_model.safetensors')
    expect(hostOnWidgetChanged).toHaveBeenCalledWith(
      'host_ckpt_name',
      'real_model.safetensors',
      'fake_model.safetensors',
      hostWidget
    )
    expect(captureCanvasState).toHaveBeenCalledOnce()
  })
})
