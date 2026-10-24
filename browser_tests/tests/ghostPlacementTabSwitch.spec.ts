import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

const SEARCH_POSITION = { x: 400, y: 400 }

function getActiveChangeCount(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(
    () =>
      (window.app!.extensionManager as WorkspaceStore).workflow.activeWorkflow
        ?.changeTracker.changeCount
  )
}

async function switchToTab(comfyPage: ComfyPage, index: number) {
  const { topbar } = comfyPage.menu
  await topbar.getTab(index).click()
  await expect(topbar.getTab(index).and(topbar.getActiveTab())).toBeVisible()
}

for (const mode of ['litegraph', 'vue'] as const) {
  test.describe(
    `Ghost placement across a workflow tab switch (${mode} mode)`,
    { tag: mode === 'vue' ? ['@workflow', '@vue-nodes'] : ['@workflow'] },
    () => {
      test.use({
        initialSettings: { 'Comfy.NodeSearchBoxImpl.FollowCursor': true }
      })

      test('cancels the unplaced node and keeps later edits in that workflow', async ({
        comfyPage
      }) => {
        const { searchBoxV2 } = comfyPage
        const { topbar } = comfyPage.menu

        // Tab 0 is workflow A (default graph); tab 1 is a new blank workflow B.
        await topbar.openBlankWorkflows(1)
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

        await test.step('Search a node in B and leave it following the cursor', async () => {
          await searchBoxV2.openByDoubleClickCanvas(SEARCH_POSITION)
          await searchBoxV2.input.fill('KSampler')
          await expect(searchBoxV2.results.first()).toContainText('KSampler')
          await comfyPage.page.keyboard.press('Enter')
          await expect(searchBoxV2.dialog).toBeHidden()
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                () => window.app!.canvas.state.ghostNodeId != null
              )
            )
            .toBe(true)
        })

        await test.step('Switch to A and back to B without placing it', async () => {
          await switchToTab(comfyPage, 0)
          await switchToTab(comfyPage, 1)
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(0)
        })

        await test.step('A node placed afterwards in B survives a tab round trip', async () => {
          // A plain canvas click, as a user would make before searching again.
          await comfyPage.page.mouse.click(SEARCH_POSITION.x, SEARCH_POSITION.y)
          await searchBoxV2.addNode('KSampler', { position: SEARCH_POSITION })
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(1)

          await switchToTab(comfyPage, 0)
          await switchToTab(comfyPage, 1)
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(1)
          await expect.poll(() => getActiveChangeCount(comfyPage)).toBe(0)
        })
      })
    }
  )
}
