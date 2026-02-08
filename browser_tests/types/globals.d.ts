import type { LGraph } from '@/lib/litegraph/src/LGraph'
// eslint-disable-next-line unused-imports/no-unused-imports -- used in typeof
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import type { ComfyApp } from '@/scripts/app'
import type { ExtensionManager } from '@/types/extensionTypes'
import type { useWorkspaceStore } from '@/stores/workspaceStore'

/**
 * Helper type for accessing nodes by ID in browser tests.
 * Provides typed access to graph internals without requiring `any`.
 */
export interface TestGraphAccess {
  _nodes_by_id: Record<string, LGraphNode>
}

interface AppReadiness {
  featureFlagsReceived: boolean
  apiInitialized: boolean
  appInitialized: boolean
}

interface CapturedMessages {
  clientFeatureFlags: unknown
  serverFeatureFlags: unknown
}

/**
 * Internal store type for browser test access.
 * At runtime, `app.extensionManager` is assigned `useWorkspaceStore()`, which
 * implements the public `ExtensionManager` interface plus internal store properties.
 *
 * Use the `wss()` helper function to access store properties in page.evaluate():
 * @example
 * ```ts
 * await page.evaluate(() => wss().workflow.syncWorkflows())
 * ```
 */
export type WorkspaceStore = ReturnType<typeof useWorkspaceStore>

/**
 * Test-only extension manager type that exposes both the public API and
 * internal store properties. This intersection accurately reflects the
 * runtime reality where extensionManager is the workspace store.
 */
export type TestExtensionManager = ExtensionManager & WorkspaceStore

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

    // Feature flags test globals
    __capturedMessages?: CapturedMessages
    __appReadiness?: AppReadiness

    /**
     * WebSocket store used by test fixtures for mocking WebSocket connections.
     * @see browser_tests/fixtures/ws.ts
     */
    __ws__?: Record<string, WebSocket>
  }

  /**
   * WorkspaceStore shorthand - returns the workspace store with full typing.
   * Centralizes the type assertion in one place.
   *
   * @example
   * ```ts
   * await page.evaluate(() => wss().workflow.syncWorkflows())
   * ```
   */
  function wss(): TestExtensionManager

  const app: ComfyApp | undefined
  const graph: LGraph | undefined
  const LiteGraph: LiteGraphGlobal | undefined
  const LGraphBadge: typeof LGraphBadge | undefined
}
