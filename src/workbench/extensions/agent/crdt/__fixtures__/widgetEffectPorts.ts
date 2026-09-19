import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

import type { SemanticWidgetEffectPort } from '../graphMutations'

/** For construction sites whose subject is not widget effects. */
export const inertWidgetEffectPort: SemanticWidgetEffectPort = {
  valueApplied() {}
}

export interface RecordedWidgetEffect {
  nodeId: NodeId
  name: string
  value: WidgetValue
  previous: WidgetValue
}

export function createRecordingWidgetEffectPort(): {
  port: SemanticWidgetEffectPort
  effects: RecordedWidgetEffect[]
} {
  const effects: RecordedWidgetEffect[] = []
  return {
    effects,
    port: {
      valueApplied(_scope, nodeId, name, value, previous) {
        effects.push({ nodeId, name, value, previous })
      }
    }
  }
}
