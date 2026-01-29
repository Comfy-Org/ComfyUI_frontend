import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Note Node', { tag: '@node' }, () => {
  test('Can load node nodes', { tag: '@screenshot' }, async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('nodes/note_nodes')
    await expect(comfyPage.canvas).toHaveScreenshot('note_nodes.png')
  })
})
