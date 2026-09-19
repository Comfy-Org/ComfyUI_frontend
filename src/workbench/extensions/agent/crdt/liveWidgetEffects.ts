import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import type { SemanticWidgetEffectPort } from './graphMutations'

export interface LiveWidgetEffectDeps {
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
  /** The canvas showing that graph; passed to `callback` like the Vue path. */
  getCanvas(): LGraphCanvas | undefined
}

export function createLiveWidgetEffectPort(
  _deps: LiveWidgetEffectDeps
): SemanticWidgetEffectPort {
  return {
    valueApplied() {}
  }
}
