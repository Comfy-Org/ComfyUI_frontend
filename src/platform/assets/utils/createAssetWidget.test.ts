import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

type AssetWidgetNode = Parameters<typeof createAssetWidget>[0]['node']

interface HostAssetWidget extends IBaseWidget<
  string,
  'asset',
  IWidgetAssetOptions
> {
  node: {
    onWidgetChanged?: (
      name: string,
      value: unknown,
      oldValue: unknown,
      widget: IBaseWidget
    ) => void
  }
}

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
  const widgets: IBaseWidget<string, 'asset', IWidgetAssetOptions>[] = []
  const node: AssetWidgetNode = {
    addWidget(type, name, value, callback, options) {
      if (type !== 'asset') throw new Error('Expected asset widget')
      if (!options || typeof options === 'string') {
        throw new Error('Expected asset widget options')
      }

      const widget: IBaseWidget<string, 'asset', IWidgetAssetOptions> = {
        type,
        name,
        value,
        callback: typeof callback === 'function' ? callback : undefined,
        options,
        y: 0
      }
      widgets.push(widget)
      return widget
    }
  }

  return { node, widgets }
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
    const { node } = createAssetWidgetNode()
    const onValueChange =
      vi.fn<
        (widget: IBaseWidget, newValue: string, oldValue: unknown) => void
      >()
    const widget = createAssetWidget({
      node,
      widgetName: 'ckpt_name',
      nodeTypeForBrowser: 'CheckpointLoaderSimple',
      inputNameForBrowser: 'ckpt_name',
      defaultValue: 'fake_model.safetensors',
      onValueChange
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
    expect(onValueChange).toHaveBeenCalledWith(
      widget,
      'real_model.safetensors',
      'fake_model.safetensors'
    )
    expect(captureCanvasState).toHaveBeenCalledOnce()
  })

  it('commits cloned asset modal selections through the promoted host widget', async () => {
    const { node } = createAssetWidgetNode()
    const sourceOnValueChange =
      vi.fn<
        (widget: IBaseWidget, newValue: string, oldValue: unknown) => void
      >()
    const sourceWidget = createAssetWidget({
      node,
      widgetName: 'ckpt_name',
      nodeTypeForBrowser: 'CheckpointLoaderSimple',
      inputNameForBrowser: 'ckpt_name',
      defaultValue: 'fake_model.safetensors',
      onValueChange: sourceOnValueChange
    })
    assertAssetOptions(sourceWidget.options)
    const hostCallback = vi.fn<NonNullable<IBaseWidget['callback']>>()
    const hostOnWidgetChanged =
      vi.fn<NonNullable<HostAssetWidget['node']['onWidgetChanged']>>()
    const hostWidget: HostAssetWidget = {
      type: 'asset',
      name: 'host_ckpt_name',
      value: 'fake_model.safetensors',
      callback: hostCallback,
      options: sourceWidget.options,
      node: { onWidgetChanged: hostOnWidgetChanged },
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

    expect(sourceOnValueChange).not.toHaveBeenCalled()
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
