import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Load Workflow in Media', () => {
  ;[
    'workflow.webp',
    'edited_workflow.webp',
    'no_workflow.webp',
    'large_workflow.webp',
    'workflow.webm'
  ].forEach(async (fileName) => {
    test(`Load workflow in ${fileName}`, async ({ comfyPage }) => {
      await comfyPage.dragAndDropFile(fileName)
      await expect(comfyPage.canvas).toHaveScreenshot(`${fileName}.png`)
    })
  })
})
