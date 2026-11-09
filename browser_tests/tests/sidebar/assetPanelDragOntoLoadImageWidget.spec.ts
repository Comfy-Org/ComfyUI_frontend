import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  STALE_TEMP_ASSET,
  STALE_TEMP_CARD_TEXT,
  STALE_TEMP_FILENAME
} from '@e2e/fixtures/data/assetFixtures'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

// PM-1407: https://linear.app/comfyorg/issue/PM-1407
test.describe(
  'Asset panel drag onto an existing Load Image widget',
  { tag: ['@vue-nodes', '@cloud'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.assets.mockCloudAssets({
        assets: [STALE_TEMP_ASSET],
        total: 1,
        has_more: false
      })
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    })

    for (const { title, tempAvailable } of [
      {
        title: 'loads a dropped temp image from its own directory',
        tempAvailable: true
      },
      {
        title: 'recovers a dropped image whose temp file is unavailable',
        tempAvailable: false
      }
    ]) {
      test(title, async ({ comfyPage }) => {
        const tab = comfyPage.menu.assetsTab
        await tab.open()
        const card = tab.getAssetCardByName(STALE_TEMP_CARD_TEXT)
        await expect(card).toBeVisible()

        const [loadImageNodeRef] =
          await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
        await loadImageNodeRef.centerOnNode()
        const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
        await expect(loadImageNode).toBeVisible()

        await comfyPage.page.route('**/view?**', async (route) => {
          const url = new URL(route.request().url())
          const filename = url.searchParams.get('filename')
          if (
            (filename === STALE_TEMP_FILENAME &&
              (!tempAvailable || url.searchParams.get('type') !== 'temp')) ||
            filename === `${STALE_TEMP_FILENAME} [temp]`
          ) {
            return route.fulfill({ status: 404 })
          }
          return route.fulfill({ path: assetPath('test_upload_image.png') })
        })

        await test.step('Drop the asset onto Load Image', async () => {
          await card.dragTo(loadImageNode)
          const imageWidget = await loadImageNodeRef.getWidgetByName('image')
          await expect
            .poll(() => imageWidget.getValue())
            .toBe(`${STALE_TEMP_FILENAME} [temp]`)
        })

        await test.step('Show the dropped asset preview', async () => {
          test.fail(!tempAvailable)
          await expect(
            loadImageNode.getByTestId(TestIds.node.mainImage)
          ).toBeVisible()
          await expect(
            loadImageNode.getByTestId(TestIds.errors.imageLoadError)
          ).toBeHidden()
        })
      })
    }
  }
)
