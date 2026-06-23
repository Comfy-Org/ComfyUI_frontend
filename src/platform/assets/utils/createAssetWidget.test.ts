import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IAssetWidget,
  IBaseWidget
} from '@/lib/litegraph/src/types/widgets'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { createAssetWidget } from './createAssetWidget'

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/assets/composables/useAssetBrowserDialog', () => {
  const show = vi.fn()
  const browse = vi.fn()
  const dialog = { show, browse }
  return {
    useAssetBrowserDialog: () => dialog
  }
})

function checkpointAsset(name: string): AssetItem {
  return {
    id: `asset-${name}`,
    name,
    hash: 'checkpoint-hash',
    mime_type: 'application/octet-stream',
    tags: []
  }
}

function expectAssetWidget(
  widget: IBaseWidget
): asserts widget is IAssetWidget {
  if (widget.type !== 'asset') {
    throw new Error('Expected createAssetWidget to create an asset widget')
  }
}

describe('createAssetWidget', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('notifies the widget callback when the asset browser commits a selected filename', async () => {
    const node: Pick<LGraphNode, 'addWidget'> = {
      addWidget(type, name, value, callback, options): IBaseWidget {
        return {
          type,
          name,
          value,
          callback: typeof callback === 'function' ? callback : undefined,
          options:
            typeof options === 'string'
              ? { property: options }
              : (options ?? {}),
          y: 0
        }
      }
    }
    const callback = vi.fn<NonNullable<IBaseWidget['callback']>>()
    const onValueChange =
      vi.fn<
        (widget: IBaseWidget, newValue: string, oldValue: unknown) => void
      >()
    const widget = createAssetWidget({
      node,
      widgetName: 'ckpt_name',
      nodeTypeForBrowser: 'CheckpointLoaderSimple',
      defaultValue: 'fake_model.safetensors',
      onValueChange
    })

    expectAssetWidget(widget)

    widget.callback = callback
    await widget.options.openModal(widget)

    const showOptions = vi.mocked(useAssetBrowserDialog().show).mock
      .calls[0]?.[0]
    if (!showOptions) {
      throw new Error('Expected the asset browser dialog to open')
    }

    showOptions.onAssetSelected?.(checkpointAsset('real_model.safetensors'))

    expect(widget.value).toBe('real_model.safetensors')
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('real_model.safetensors')
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(
      widget,
      'real_model.safetensors',
      'fake_model.safetensors'
    )
  })
})
