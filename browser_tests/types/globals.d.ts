import type { LGraph } from '@/lib/litegraph/src/LGraph'
// eslint-disable-next-line unused-imports/no-unused-imports -- used in typeof
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import type { ComfyApp } from '@/scripts/app'
import type { useWorkspaceStore } from '@/stores/workspaceStore'

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

declare global {
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
  }

  const app: ComfyApp | undefined
  const graph: LGraph | undefined
  const LiteGraph: LiteGraphGlobal | undefined
  const LGraphBadge: typeof LGraphBadge | undefined
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
