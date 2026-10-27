import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  STALE_TEMP_ASSET,
  STALE_TEMP_CARD_TEXT
} from '@e2e/fixtures/data/assetFixtures'
import { openErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

const tempReference = `${STALE_TEMP_ASSET.hash} [temp]`
const sameHashOutputReference = `${STALE_TEMP_ASSET.hash} [output]`
const deletedAssetPath = `/api/assets/${STALE_TEMP_ASSET.id}`

test.use({
  initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
})

test.describe(
  'Asset panel insert of a temp asset, then delete',
  { tag: ['@cloud'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.assets.mockCloudAssets({
        assets: [STALE_TEMP_ASSET],
        total: 1,
        has_more: false
      })
      await comfyPage.page.route(/\/api\/assets\/[^/?#]+$/, (route) =>
        route.request().method() === 'DELETE'
          ? route.fulfill({ status: 204, body: '' })
          : route.fallback()
      )
      await comfyPage.page.route('**/view?**', (route) =>
        route.fulfill({ path: assetPath('test_upload_image.png') })
      )
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.page.evaluate((value) => {
        const [loadImage] = window.app!.graph.findNodesByType('LoadImage')
        const widget = loadImage.widgets?.find((w) => w.name === 'image')
        if (!widget) throw new Error('Load Image widget not found')
        widget.value = value
      }, sameHashOutputReference)
    })

    test('writes the temp root and clears only that reference on delete', async ({
      comfyPage
    }) => {
      const loadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(loadImageNodes).toHaveLength(1)
      const [outputNode] = loadImageNodes
      const outputWidget = await outputNode.getWidgetByName('image')
      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await test.step('Insert the temp asset as a node', async () => {
        await tab.rightClickAsset(STALE_TEMP_CARD_TEXT)
        await tab.contextMenuItem('Insert as node in workflow').click()
        await expect
          .poll(
            async () =>
              (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
          )
          .toBe(2)
      })

      const insertedNode = (
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      ).find((node) => node.id !== outputNode.id)
      if (!insertedNode) throw new Error('Inserted Load Image node not found')
      const insertedWidget = await insertedNode.getWidgetByName('image')
      const insertedPreviewCount = () =>
        comfyPage.page.evaluate(
          (id) => window.app!.graph.getNodeById(id)?.imgs?.length ?? 0,
          insertedNode.id
        )

      await expect.poll(() => insertedWidget.getValue()).toBe(tempReference)
      await expect.poll(insertedPreviewCount).toBeGreaterThan(0)

      await test.step('Delete the temp asset', async () => {
        const deleteRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'DELETE' &&
            new URL(request.url()).pathname === deletedAssetPath
        )
        await tab.rightClickAsset(STALE_TEMP_CARD_TEXT)
        await tab.contextMenuItem('Delete').click()
        await comfyPage.confirmDialog.click('delete')
        await deleteRequest
      })

      await expect.poll(() => insertedWidget.getValue()).toBe('')
      await expect.poll(insertedPreviewCount).toBe(0)
      await expect
        .poll(() => outputWidget.getValue())
        .toBe(sameHashOutputReference)

      await openErrorsTab(comfyPage)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.missingMediaRow)
      ).toHaveText(['Load Image - image'])
    })
  }
)
