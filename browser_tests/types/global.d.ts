import type { ComfyApp } from '@/scripts/app'
import type { LGraphBadge, LiteGraph } from '@/lib/litegraph/src/litegraph'

declare global {
  interface Window {
    // Application globals
    app?: ComfyApp
    LiteGraph?: typeof LiteGraph
    LGraphBadge?: typeof LGraphBadge

    // Test-only properties used in browser tests
    TestCommand?: boolean
    foo?: unknown
    value?: unknown
    widgetValue?: unknown
    selectionCommandExecuted?: boolean
    changeCount?: number
  }
}

export {}
