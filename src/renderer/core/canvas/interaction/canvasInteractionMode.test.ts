import { describe, expect, it } from 'vitest'

import { createCanvasInteractionMode } from '@/renderer/core/canvas/interaction/canvasInteractionMode'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

describe('createCanvasInteractionMode', () => {
  it.for([{ picking: false }, { picking: true }])(
    'reads selectOnly=$picking from agent node picking',
    ({ picking }) => {
      const mode = createCanvasInteractionMode()

      useAgentNodeSelectionStore().isActive = picking

      expect(mode.isSelectOnly()).toBe(picking)
    }
  )
})
