import { expect } from '@playwright/test'

import { insertOverlapTest as test } from '@e2e/fixtures/agentInsertWorkflowOverlapFixture'

// PM-2232 (https://linear.app/comfyorg/issue/PM-2232): an agent-inserted
// template landed on top of the nodes already in the tab. See the fixture for
// the populated canvas and the template's baked-in Z-Image node rects.
test.describe(
  'Agent insert_workflow into a populated tab',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    test.use({ connectWebSocketToServer: false })
    test.describe.configure({ timeout: 60_000 })

    test('places an inserted template clear of the nodes already on the canvas', async ({
      populatedTab
    }) => {
      await populatedTab.insertTemplate()

      const placement = await populatedTab.readPlacement()
      expect(placement.overlaps).toEqual([])
      // The template moves as one unit: its internal layout is unchanged.
      // Template note at x -420, sampler at 130, save at 570, all at y 200.
      expect(placement.layoutFromNote).toEqual({
        'Template note': [0, 0],
        'Template sampler': [550, 0],
        'Template save': [990, 0]
      })
    })
  }
)
