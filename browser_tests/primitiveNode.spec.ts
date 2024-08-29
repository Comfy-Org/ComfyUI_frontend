import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Primitive Node', () => {
  test('Can load with correct size', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('primitive_node')
    await expect(comfyPage.canvas).toHaveScreenshot('primitive_node.png')
  })
})
