import type { ComfyApp } from '@/scripts/app'
import type { LGraph } from '@/lib/litegraph'
import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'

interface AppReadiness {
  featureFlagsReceived: boolean
  apiInitialized: boolean
  appInitialized: boolean
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

    // Feature flags test globals
    __capturedMessages?: CapturedMessages
    __appReadiness?: AppReadiness
  }
}

export {}
