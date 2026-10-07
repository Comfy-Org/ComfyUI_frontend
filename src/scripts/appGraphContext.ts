import type { LGraph } from '@/lib/litegraph/src/litegraph'

export interface AppGraphContext {
  readonly isGraphReady: boolean
  readonly rootGraph: LGraph
}

let appGraphContext: AppGraphContext | undefined

export function registerAppGraphContext(context: AppGraphContext): void {
  appGraphContext = context
}

export function getAppGraphContext(): AppGraphContext | undefined {
  return appGraphContext
}
