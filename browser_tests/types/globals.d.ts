import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphBadge as LGraphBadgeClass } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import type { ComfyApp } from '@/scripts/app'
import type { useWorkspaceStore } from '@/stores/workspaceStore'
import type { App } from 'vue'

/**
 * Helper type for accessing nodes by ID in browser tests.
 * Provides typed access to graph internals without requiring `any`.
 */
export interface TestGraphAccess {
  _nodes_by_id: Partial<Record<string, LGraphNode>>
}

interface AppReadiness {
  featureFlagsReceived: boolean
  apiInitialized: boolean
  appInitialized: boolean
}

export interface TabSwitchLens {
  afterConfigure: string[][]
  removed: string[]
}

interface CapturedMessages {
  clientFeatureFlags: unknown
  serverFeatureFlags: unknown
}

interface PerfFrameState {
  frameRequestId: number
  lastTimestamp: number | null
  durationsMs: number[]
}

interface PerfLongtaskState {
  observer: PerformanceObserver
  tbtMs: number
}

declare global {
  interface HTMLElement {
    __vue_app__?: App
  }

  interface Window {
    app?: ComfyApp
    graph?: LGraph
    LiteGraph?: LiteGraphGlobal
    LGraphBadge?: typeof LGraphBadge

    // Test-specific globals used for assertions
    foo?: boolean
    TestCommand?: boolean
    changeCount?: number
    widgetValue?: unknown
    __commandExecutionCounts?: Record<string, number>
    __autoShownReads?: number
    __perfFrameState?: PerfFrameState
    __perfLongtaskState?: PerfLongtaskState

    // Feature flags test globals
    __capturedMessages?: CapturedMessages
    __appReadiness?: AppReadiness

    /**
     * WebSocket store used by test fixtures for mocking WebSocket connections.
     * @see browser_tests/fixtures/ws.ts
     */
    __ws__?: Record<string, WebSocket>

    /**
     * Node ids observed at two moments of a workflow tab return: right after
     * the canvas was rebuilt from the tab's snapshot, and every node removed
     * from the live graph since the observer was installed.
     * @see browser_tests/tests/agent/agentHumanAddTabSwitch.spec.ts
     */
    __tabSwitchLens?: TabSwitchLens
    /**
     * Every `data-node-id` the DOM has mounted since the recorder was
     * installed, so a test can tell "the node was rendered and then removed"
     * apart from "the node was never rendered".
     * @see browser_tests/tests/agent/agentClearedWorkflowStaysCleared.spec.ts
     */
    __mountedNodeIds?: Set<string>

    __mountedNodeObserver?: MutationObserver
    __agentRecoveryGraph?: LGraph
  }

  const app: ComfyApp | undefined
  const graph: LGraph | undefined
  const LiteGraph: LiteGraphGlobal | undefined
  const LGraphBadge: typeof LGraphBadgeClass | undefined
}

/**
 * Internal store type for browser test access.
 * Used to access properties not exposed via the public ExtensionManager interface.
 *
 * @example
 * ```ts
 * await page.evaluate(() => {
 *   ;(window.app!.extensionManager as WorkspaceStore).workflow.syncWorkflows()
 * })
 * ```
 */
export type WorkspaceStore = ReturnType<typeof useWorkspaceStore>
