import { useToast } from '@/components/ui/toast'
import { useDialogStore } from '@/stores/dialogStore'

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

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation((...args: unknown[]) =>
    toastAdd('success', ...args)
  )
  vi.mocked(useToast().error).mockImplementation((...args: unknown[]) =>
    toastAdd('error', ...args)
  )
  vi.mocked(useToast().info).mockImplementation((...args: unknown[]) =>
    toastAdd('info', ...args)
  )
  vi.mocked(useToast().warning).mockImplementation((...args: unknown[]) =>
    toastAdd('warning', ...args)
  )
  vi.mocked(useToast().loading).mockImplementation((...args: unknown[]) =>
    toastAdd('loading', ...args)
  )
  vi.mocked(useToast().custom).mockImplementation((...args: unknown[]) =>
    toastAdd('custom', ...args)
  )
})
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

describe('useCompositorEditor', () => {
  const node = { id: toNodeId(1) } as unknown as LGraphNode

  beforeEach(() => {
    clearCompositorLayers(node)
  })

  it('shows a toast and keeps the dialog closed without cached layers', () => {
    renderCompositorEditor().openCompositorEditor(node)

    expect(toastAdd).toHaveBeenCalledWith(
      'info',
      expect.any(String),
      expect.objectContaining({ description: 'compositor.runWorkflowFirst' })
    )
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
  })

  it('shows a toast when layers are cached without a fingerprint', () => {
    setCompositorLayers(node, [
      { filename: 'a.png', subfolder: '', type: 'temp' }
    ])

    renderCompositorEditor().openCompositorEditor(node)

    expect(toastAdd).toHaveBeenCalledWith(
      'info',
      expect.any(String),
      expect.objectContaining({ description: 'compositor.runWorkflowFirst' })
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

    expect(vi.mocked(toastAdd)).not.toHaveBeenCalled()
    expect(vi.mocked(useDialogStore().showDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node, mode: 'compositor' }
      })
    )
  })
})
