import { expect } from '@playwright/test'

import { insertOverlapTest as test } from '@e2e/fixtures/agentInsertWorkflowOverlapFixture'
import { PM_2232_SOURCE } from '@e2e/fixtures/data/agentInsertWorkflowOverlap'

test.describe(
  'Agent insert_workflow into a populated tab (PM-2232)',
  {
    tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'],
    annotation: { type: 'issue', description: PM_2232_SOURCE }
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
