import { render, screen } from '@testing-library/vue'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  app: { extensionManager: undefined as unknown },
  autoExposeKnownPreviewNodes: vi.fn(),
  flushProxyWidgetMigration: vi.fn(),
  initializeConflictDetection: vi.fn().mockResolvedValue(undefined),
  lGraph: {
    autoExposePreviewNodes: undefined as unknown,
    proxyWidgetMigrationFlush: undefined as unknown
  },
  startStoreBootstrap: vi.fn().mockResolvedValue(undefined),
  workspaceStore: undefined as unknown as { spinner: boolean }
}))

vi.mock('@/core/graph/subgraph/migration/proxyWidgetMigration', () => ({
  flushProxyWidgetMigration: mocks.flushProxyWidgetMigration
}))
vi.mock('@/core/graph/subgraph/promotionUtils', () => ({
  autoExposeKnownPreviewNodes: mocks.autoExposeKnownPreviewNodes
}))
vi.mock('@/lib/litegraph/src/litegraph', () => ({ LGraph: mocks.lGraph }))
vi.mock('@/scripts/app', () => ({ app: mocks.app }))
vi.mock('@/stores/bootstrapStore', () => ({
  useBootstrapStore: () => ({
    startStoreBootstrap: mocks.startStoreBootstrap
  })
}))
vi.mock('@/stores/workspaceStore', async () => {
  const { reactive } = await import('vue')
  mocks.workspaceStore = reactive({ spinner: false })
  return { useWorkspaceStore: () => mocks.workspaceStore }
})
vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: mocks.initializeConflictDetection
    })
  })
)

import { useEditorStartup } from './useEditorStartup'

describe('useEditorStartup', () => {
  it('installs legacy bridges and starts Editor-owned work once', async () => {
    const TestComponent = defineComponent(() => {
      useEditorStartup()
      return () => h('div')
    })

    const first = render(TestComponent)
    first.unmount()
    render(TestComponent)

    expect(mocks.app.extensionManager).toBe(mocks.workspaceStore)
    expect(mocks.startStoreBootstrap).toHaveBeenCalledOnce()
    await vi.waitFor(() => {
      expect(mocks.initializeConflictDetection).toHaveBeenCalledOnce()
    })

    const hostNode = {}
    const nodeData: { widgets_values: string[] } = {
      widgets_values: ['value']
    }
    const proxyWidgetMigrationFlush = mocks.lGraph
      .proxyWidgetMigrationFlush as (
      hostNode: object,
      nodeData: { widgets_values: string[] }
    ) => void
    proxyWidgetMigrationFlush(hostNode, nodeData)
    expect(mocks.flushProxyWidgetMigration).toHaveBeenCalledWith({
      hostNode,
      hostWidgetValues: nodeData.widgets_values
    })

    const autoExposePreviewNodes = mocks.lGraph.autoExposePreviewNodes as (
      hostNode: object
    ) => void
    autoExposePreviewNodes(hostNode)
    expect(mocks.autoExposeKnownPreviewNodes).toHaveBeenCalledWith(hostNode)
  })

  it('dismisses the splash only when Editor loading becomes ready', async () => {
    document.body.innerHTML =
      '<div id="splash-loader" data-testid="splash-loader"></div>'
    mocks.workspaceStore.spinner = false

    const TestComponent = defineComponent(() => {
      useEditorStartup()
      return () => h('div')
    })
    render(TestComponent)

    mocks.workspaceStore.spinner = true
    await nextTick()
    expect(screen.getByTestId('splash-loader')).not.toBeNull()

    mocks.workspaceStore.spinner = false
    await nextTick()
    expect(screen.queryByTestId('splash-loader')).toBeNull()
  })
})
