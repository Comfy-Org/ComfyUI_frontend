import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'
import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { STABLE_CHECKPOINT } from '@e2e/fixtures/data/assetFixtures'
import { withAsset } from '@e2e/fixtures/helpers/AssetHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { expect, mergeTests } from '@playwright/test'

const test = mergeTests(agentConversationTest, assetApiFixture)

// @comfyorg/comfy-multi-player: the recorded second turn changes the graph
// while transport is disconnected. Keeping the first graph cannot pass.
test.describe(
  'Multiplayer document catch-up',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-two-turn-dependent-edit',
      modelLibraryOptions: { folders: [] }
    })

    test('recovers edits missed while the document socket was disconnected', async ({
      agentConversation,
      page
    }) => {
      await agentConversation.sendPrompt(0)
      await agentConversation.replayResponse(0)
      await agentConversation.waitForTurnComplete()
      await agentConversation.expectCanvasReplayed(0)
      const before = agentConversation.subscribeCount()
      await page.screenshot({
        path: test.info().outputPath('01-before-drop.png')
      })

      await agentConversation.disconnectAndApplyRecordedTurn(1)

      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBe(before + 1)
      await agentConversation.expectCanvasReplayed(1)
      await page.screenshot({
        path: test.info().outputPath('02-after-catch-up.png')
      })
    })

    test('exports agent edits and reloads the saved workflow file after a page reload', async ({
      assetApi,
      agentConversation,
      page
    }) => {
      assetApi.configure(withAsset(STABLE_CHECKPOINT))
      await assetApi.mock()
      await agentConversation.runTurns()
      const rows = await agentConversation.renderedWidgetRows()
      expect(rows).toContainEqual({
        nodeId: '4',
        label: 'ckpt_name',
        value: 'ckpt_namesd_xl_base_1.0.safetensors',
        invalid: false
      })
      const topbar = new Topbar(page)
      const downloadPromise = page.waitForEvent('download')
      await topbar.exportWorkflow('cmp-acceptance-saved')
      const download = await downloadPromise
      const savedPath = test.info().outputPath('cmp-acceptance-saved.json')
      await download.saveAs(savedPath)

      await topbar.newWorkflowButton.click()
      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      await page.reload()
      await waitForCloudApp(page)
      // Startup restores tabs after extensionManager exists. Import only once
      // that restoration is finished, otherwise it can overwrite the new graph.
      const loadingOverlay = page.getByTestId(TestIds.app.loadingOverlay)
      await loadingOverlay.waitFor({ state: 'attached' })
      await loadingOverlay.waitFor({ state: 'hidden' })
      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      const before = agentConversation.subscribeCount()
      await page.locator('#comfy-file-input').setInputFiles(savedPath)

      await agentConversation.expectCanvasReplayed(1)
      await expect
        .poll(() => agentConversation.renderedWidgetRows())
        .toEqual(rows)
      expect(agentConversation.subscribeCount()).toBe(before)
      await page.screenshot({
        path: test.info().outputPath('03-file-reloaded.png')
      })
    })
  }
)
