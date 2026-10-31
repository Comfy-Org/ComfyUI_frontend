import { expect } from '@playwright/test'

import { insertOverlapTest as test } from '@e2e/fixtures/agentInsertWorkflowOverlapFixture'

test.describe(
  'Agent insert_workflow into a populated tab (PM-2232)',
  {
    tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description:
        'https://linear.app/comfyorg/issue/PM-2232/workflow-inserted-into-an-existing-tab-lands-on-top-of-the-existing'
    }
  },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('places an inserted template clear of the nodes already on the canvas', async ({
      populatedTab
    }) => {
      await populatedTab.insertTemplate()

      const placement = await populatedTab.readPlacement()
      expect(placement.overlaps).toEqual([])
      expect(placement.layoutFromNote).toEqual({
        'Template note': [0, 0],
        'Template sampler': [550, 0],
        'Template save': [990, 0]
      })
    })
  }
)
