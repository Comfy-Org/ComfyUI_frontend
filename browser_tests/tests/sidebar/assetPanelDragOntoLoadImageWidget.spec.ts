import type { Asset } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

// PM-1407: https://linear.app/comfyorg/issue/PM-1407
const STALE_TEMP_FILENAME = 'ComfyUI_temp_thsmm_00001_.png'
const STALE_TEMP_ASSET: Asset = {
  id: '55555555-5555-4555-a555-555555555555',
  name: STALE_TEMP_FILENAME,
  job_id: '66666666-6666-4666-a666-666666666666',
  tags: ['output', 'temp'],
  mime_type: 'image/png',
  size: 12_345,
  created_at: '2026-09-19T00:00:00.000Z',
  updated_at: '2026-09-19T00:00:00.000Z',
  last_access_time: '2026-09-19T00:00:00.000Z'
}
// MediaAssetCard renders the basename without extension.
const STALE_TEMP_CARD_TEXT = STALE_TEMP_FILENAME.replace(/\.[^.]+$/, '')

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

        await card.dragTo(loadImageNode)

        const imageWidget = await loadImageNodeRef.getWidgetByName('image')

        // Required precondition, asserted as a plain `expect` above
        // `test.fail()`: the drag must actually land and set the widget to
        // the asset's original, un-uploaded location, exactly matching the
        // report ("it changed the image file name correctly so I assume it
        // is loaded"). A failure here is a broken test setup, not the
        // reported bug, so it must surface as a real failure instead of
        // being swallowed as an "expected failure" that never reached the
        // preview assertion below.
        await expect
          .poll(() => imageWidget.getValue())
          .toBe(`${STALE_TEMP_FILENAME} [temp]`)

        test.fail()
        await expect(
          loadImageNode.getByTestId(TestIds.node.mainImage)
        ).toBeVisible()
        await expect(
          loadImageNode.getByTestId(TestIds.errors.imageLoadError)
        ).toBeHidden()
      })
    }
  }
)
