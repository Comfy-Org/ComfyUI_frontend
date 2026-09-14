import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { useCompositorEditor } from './useCompositorEditor'
import {
  clearCompositorLayers,
  setCompositorLayers
} from './useCompositorLayers'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      layerEditor: { title: 'Layer editor' },
      compositor: { runWorkflowFirst: 'Run the workflow first' }
    }
  }
})

function mountComposable(): ReturnType<typeof useCompositorEditor> {
  let composable!: ReturnType<typeof useCompositorEditor>
  render(
    {
      setup() {
        composable = useCompositorEditor()
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  return composable
}

beforeEach(() => {
  vi.mocked(useToastStore().add).mockImplementation(() => undefined)
})

describe('useCompositorEditor', () => {
  const node = { id: toNodeId(1) } as unknown as LGraphNode

  beforeEach(() => {
    clearCompositorLayers(node)
  })

  it('shows a toast and keeps the dialog closed without cached layers', () => {
    mountComposable().openCompositorEditor(node)

    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        summary: 'Layer editor',
        detail: 'Run the workflow first'
      })
    )
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
  })

  it('shows a toast when layers are cached without a fingerprint', () => {
    setCompositorLayers(node, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    mountComposable().openCompositorEditor(node)

    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        summary: 'Layer editor',
        detail: 'Run the workflow first'
      })
    )
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
  })

  it('opens the layer editor in compositor mode when layers are cached', () => {
    setCompositorLayers(
      node,
      [{ filename: 'a.png', subfolder: '', type: 'temp' }],
      ['hash-a']
    )

    mountComposable().openCompositorEditor(node)

    expect(vi.mocked(useToastStore().add)).not.toHaveBeenCalled()
    expect(vi.mocked(useDialogStore().showDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node, mode: 'compositor' }
      })
    )
  })
})
