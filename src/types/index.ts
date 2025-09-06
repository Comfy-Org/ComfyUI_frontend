import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { SystemStats } from '@/schemas/apiSchema'
import { ComfyApp } from '@/scripts/app'

export type { NodeLocatorId } from './nodeIdentification'
export type { SystemStats }

declare global {
  interface Window {
    /** For use by extensions and in the browser console. Where possible, import `app` from '@/scripts/app' instead. */
    app?: ComfyApp

    /** For use by extensions and in the browser console. Where possible, import `app` and access via `app.graph` instead. */
    graph?: LGraph
  }
}
