import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('API workflow serialization', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.DevMode', true)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.DevMode', false)
  })

  test('keys every API entry by its exact graph node identity', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const graphNodeIds = await comfyPage.page.evaluate(() =>
      window
        .app!.graph.serialize()
        .nodes.map((node) => String(node.id))
        .sort()
    )
    const exported = await comfyPage.workflow.getExportedWorkflow({ api: true })

    expect(Object.keys(exported).sort()).toEqual(graphNodeIds)
    for (const node of Object.values(exported)) {
      expect(node.class_type).toEqual(expect.any(String))
      expect(node.inputs).toEqual(expect.any(Object))
    }
  })
})
