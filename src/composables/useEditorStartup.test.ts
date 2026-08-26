import { render } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
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
  workspaceStore: { spinner: false }
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
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mocks.workspaceStore
}))
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
  it('installs legacy bridges and starts Editor-owned work once', () => {
    const TestComponent = defineComponent(() => {
      useEditorStartup()
      return () => h('div')
    })

    const first = render(TestComponent)
    first.unmount()
    render(TestComponent)

    expect(mocks.app.extensionManager).toBe(mocks.workspaceStore)
    expect(mocks.startStoreBootstrap).toHaveBeenCalledOnce()
    expect(mocks.initializeConflictDetection).toHaveBeenCalledOnce()

    const hostNode = {}
    const nodeData = { widgets_values: ['value'] }
    const proxyWidgetMigrationFlush = mocks.lGraph
      .proxyWidgetMigrationFlush as (
      hostNode: object,
      nodeData: typeof nodeData
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
})
