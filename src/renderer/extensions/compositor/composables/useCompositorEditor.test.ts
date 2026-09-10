import { useDialogStore } from '@/stores/dialogStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent } from 'vue'
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
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})
const apps: App[] = []

function renderCompositorEditor() {
  let editor: ReturnType<typeof useCompositorEditor> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        editor = useCompositorEditor()
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!editor) throw new Error('Compositor editor not initialized')
  return editor
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

beforeEach(() => {
  vi.mocked(useToastStore().add).mockImplementation(() => undefined)
})

describe('useCompositorEditor', () => {
  const node = { id: toNodeId(1) } as unknown as LGraphNode

  beforeEach(() => {
    clearCompositorLayers(node)
  })

  it('shows a toast and keeps the dialog closed without cached layers', () => {
    renderCompositorEditor().openCompositorEditor(node)

    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        detail: 'compositor.runWorkflowFirst'
      })
    )
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
  })

  it('shows a toast when layers are cached without a fingerprint', () => {
    setCompositorLayers(node, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    renderCompositorEditor().openCompositorEditor(node)

    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        detail: 'compositor.runWorkflowFirst'
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

    renderCompositorEditor().openCompositorEditor(node)

    expect(vi.mocked(useToastStore().add)).not.toHaveBeenCalled()
    expect(vi.mocked(useDialogStore().showDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node, mode: 'compositor' }
      })
    )
  })
})
