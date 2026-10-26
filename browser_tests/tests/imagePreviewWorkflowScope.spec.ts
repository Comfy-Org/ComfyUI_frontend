import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const firstNodeState = (comfyPage: ComfyPage) =>
  comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.at(0)
    return node
      ? { id: String(node.id), type: node.type, imgs: node.imgs?.length }
      : null
  })

async function expectLatePreviewStaysOnItsWorkflow(
  comfyPage: ComfyPage,
  waitForPreview: () => Promise<void>
) {
  const workflowB = `preview-scope-b-${Date.now().toString(36)}`

  await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
  await comfyPage.searchBoxV2.addNode('Load Image')
  await waitForPreview()
  const { id: sharedId } = (await firstNodeState(comfyPage))!

  await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
  await comfyPage.searchBoxV2.addNode('Load LoRA')
  await expect
    .poll(() => firstNodeState(comfyPage))
    .toEqual({ id: sharedId, type: 'LoraLoaderModelOnly' })
  await comfyPage.menu.topbar.saveWorkflow(workflowB)

  const held: Route[] = []
  await comfyPage.page.route('**/api/view?**', async (route) => {
    if (route.request().url().includes('example.png')) held.push(route)
    else await route.fallback()
  })

  try {
    await comfyPage.menu.topbar.closeWorkflowTab(workflowB)
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => held.length).toBeGreaterThan(0)

    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(workflowB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => firstNodeState(comfyPage))
      .toEqual({ id: sharedId, type: 'LoraLoaderModelOnly' })

    const loaded = comfyPage.page.waitForEvent('requestfinished', (req) =>
      req.url().includes('example.png')
    )
    for (const route of held.splice(0)) await route.fallback()
    await loaded
    await comfyPage.nextFrame()

    expect(await firstNodeState(comfyPage)).toEqual({
      id: sharedId,
      type: 'LoraLoaderModelOnly'
    })
  } finally {
    await comfyPage.page.unroute('**/api/view?**')
    await comfyPage.workflow.deleteWorkflow(workflowB)
  }
}

test.describe('Vue image preview workflow scope', { tag: '@vue-nodes' }, () => {
  test('a late preview load does not land on a reopened workflow node with the same id', async ({
    comfyPage
  }) => {
    await expectLatePreviewStaysOnItsWorkflow(comfyPage, async () => {
      const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
      await expect(loadImageNode.locator('img')).toBeVisible()
    })
  })
})

test.describe('Canvas image preview workflow scope', () => {
  test('a late preview load does not land on a reopened workflow node with the same id', async ({
    comfyPage
  }) => {
    await expectLatePreviewStaysOnItsWorkflow(comfyPage, async () => {
      await expect
        .poll(async () => (await firstNodeState(comfyPage))?.imgs)
        .toBeGreaterThan(0)
    })
  })
})
