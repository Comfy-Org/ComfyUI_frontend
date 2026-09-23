import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expect } from '@playwright/test'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

test.describe('Note Node', { tag: '@node' }, () => {
  test('Can load node nodes', { tag: '@screenshot' }, async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    await expect(comfyPage.canvas).toHaveScreenshot('note_nodes.png')
  })
})
