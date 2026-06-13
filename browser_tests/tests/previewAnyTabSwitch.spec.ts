import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('PreviewAny tab switch', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.setup()
  })

  test('restores preview text after switching workflow tabs', async ({
    comfyPage
  }) => {
    const previewText = 'persisted preview output'

    // Add a PreviewAny node and simulate a completed execution by writing the
    // node output the same way the backend path does (the app.nodeOutputs
    // setter), which drives the real onNodeOutputsUpdated extension hook.
    await comfyPage.page.evaluate((text) => {
      const node = window.LiteGraph!.createNode('PreviewAny')!
      node.pos = [400, 200]
      window.app!.graph.add(node)
      window.app!.nodeOutputs = { [String(node.id)]: { text } }
    }, previewText)

    const getPreviewValue = () =>
      comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n) => n.type === 'PreviewAny'
        )!
        return node.widgets?.find((w) => w.name === 'preview_text')?.value
      })

    expect(await getPreviewValue()).toBe(previewText)

    // Switching tabs reloads the graph, wiping the non-serialized preview
    // widgets; returning to the tab must restore them from the cached outputs.
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.page
      .locator('.workflow-tabs .p-togglebutton')
      .first()
      .click()

    await expect.poll(getPreviewValue).toBe(previewText)
  })
})
