import { expect } from '@playwright/test'

import { titleBarOverlapTest as test } from '@e2e/fixtures/agentTitleBarOverlapFixture'
import { BODY_GAP_PX } from '@e2e/fixtures/data/agentTitleBarOverlap'

test.describe(
  'Agent node placement clears the rendered box, not just the body (PM-961)',
  {
    tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description:
        'https://linear.app/comfyorg/issue/PM-961/workflow-node-layout'
    }
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('does not leave an agent node drawn across the node above it', async ({
      overlapTab
    }) => {
      await overlapTab.addNodeBelow()

      const placement = await overlapTab.readPlacement()

      expect(placement.unmeasured).toEqual([])
      expect(BODY_GAP_PX).toBeLessThan(placement.titleBarHeight)
      expect(placement.bodyOverlaps).toEqual([])
      expect(placement.renderedOverlaps).toEqual([])
    })
  }
)
