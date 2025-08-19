import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Note Node', () => {
  test('Can load node nodes', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('nodes/note_nodes')
    await expect(comfyPage.canvas).toHaveScreenshot('note_nodes.png')
  })
})
