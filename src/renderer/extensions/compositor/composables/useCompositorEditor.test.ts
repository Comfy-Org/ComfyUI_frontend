import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { useCompositorEditor } from './useCompositorEditor'
import {
  clearCompositorLayers,
  setCompositorLayers
} from './useCompositorLayers'

const { showDialog, toastAdd } = vi.hoisted(() => ({
  showDialog: vi.fn(),
  toastAdd: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

describe('useCompositorEditor', () => {
  const node = { id: toNodeId(1) } as unknown as LGraphNode

  beforeEach(() => {
    clearCompositorLayers(node)
  })

  it('shows a toast and keeps the dialog closed without cached layers', () => {
    useCompositorEditor().openCompositorEditor(node)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        detail: 'compositor.runWorkflowFirst'
      })
    )
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('shows a toast when layers are cached without a fingerprint', () => {
    setCompositorLayers(node, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    useCompositorEditor().openCompositorEditor(node)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        detail: 'compositor.runWorkflowFirst'
      })
    )
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('opens the layer editor in compositor mode when layers are cached', () => {
    setCompositorLayers(
      node,
      [{ filename: 'a.png', subfolder: '', type: 'temp' }],
      ['hash-a']
    )

    useCompositorEditor().openCompositorEditor(node)

    expect(toastAdd).not.toHaveBeenCalled()
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node, mode: 'compositor' }
      })
    )
  })
})
