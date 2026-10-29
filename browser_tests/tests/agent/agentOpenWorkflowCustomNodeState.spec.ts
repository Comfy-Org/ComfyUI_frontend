import { expect } from '@playwright/test'

import { test } from '@e2e/tests/agent/agentVhsSavedWorkflowFixture'
import {
  VHS_LOAD_ID,
  editedVhsCanvas,
  editedVhsLoadRecord,
  restoredVhsCanvas
} from '@e2e/fixtures/data/agent/agentVhsSavedWorkflow'

test.describe(
  'A saved custom-node workflow opened by the Agent (PM-2018)',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('the canvas keeps the output node and the saved widget values, then follows an Agent edit to them', async ({
      vhsAgent: { panel, host, canvas }
    }) => {
      await panel.sendMessage('Load my saved VHS workflow.')
      await host.subscribed()

      host.openSavedWorkflow()
      await expect.poll(() => canvas.state()).toEqual(restoredVhsCanvas)

      host.replaceRecord(VHS_LOAD_ID, editedVhsLoadRecord)
      await expect.poll(() => canvas.state()).toEqual(editedVhsCanvas)
    })
  }
)
