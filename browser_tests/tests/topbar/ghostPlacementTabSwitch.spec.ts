import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

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
        const { searchBoxV2, workflow } = comfyPage
        const { topbar } = comfyPage.menu
        const position = { x: 400, y: 400 }

        await topbar.openBlankWorkflows(1)
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
        const [tabA, tabB] = await topbar.getTabNames()
        await comfyPage.expectNodeCount(0)

        await test.step('Search a node in B and leave it following the cursor', async () => {
          await searchBoxV2.openByDoubleClickCanvas(position)
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
          await workflow.switchToTab(tabA)
          await workflow.switchToTab(tabB)
          await comfyPage.expectNodeCount(0)
        })

        await test.step('A node placed afterwards in B survives a tab round trip', async () => {
          await searchBoxV2.addNode('KSampler', { position })
          await comfyPage.expectNodeCount(1)

          await workflow.switchToTab(tabA)
          await workflow.switchToTab(tabB)
          await comfyPage.expectNodeCount(1)
          await expect.poll(() => workflow.getChangeCount()).toBe(0)
        })
      })
    }
  )
}
