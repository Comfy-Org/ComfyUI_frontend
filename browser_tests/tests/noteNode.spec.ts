import { expect } from '@playwright/test'

import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getNodeClipRegion } from '@e2e/fixtures/utils/screenshotClip'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Note Node', { tag: '@node' }, () => {
  test('Can load node nodes', { tag: '@screenshot' }, async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    const clip = await getNodeClipRegion(comfyPage, [1, 2] as NodeId[])
    await expect(comfyPage.page).toHaveScreenshot('note_nodes.png', { clip })
  })
})
