import type { Asset } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

// Repro for a nightly report: dragging an item out of the Asset Library
// panel onto an *existing* Load Image node's widget (not empty canvas)
// updates the widget's filename correctly, but the node's preview shows a
// broken image / "Image does not exist" instead of the picture.
//
// Root cause: MediaAssetCard.vue's dragStart() reads the asset's original
// output location straight off its allOutputs metadata (filename/subfolder/
// type - `ComfyUI_temp_<random>_00001_.png [temp]`, the same pattern
// folder_paths.py's own temp-file naming produces) and publishes it as
// `application/x-comfy-asset-info`. useNodeDragAndDrop.ts's onDragDrop sees
// that MIME type on the drop and treats it as an already-uploaded
// ResultItem, calling onResultItemDrop -> onUploadComplete directly
// (useNodeImageUpload.ts). That path never POSTs to `/upload/image` the way
// a real file/OS drag or paste does, so nothing copies (or even checks for)
// the file at the location the card's metadata names. When that location
// was the ephemeral `temp` folder from a since-finished job, the widget
// value is set to a real-looking annotated path that nothing backs, and the
// live preview's `/view` request 404s.
//
// This is a different mechanism from the CRDT stale-preview family (agent
// writes bypassing widget.callback/onWidgetChanged, which leaves a valid
// but stale image on screen): here the callback/onWidgetChanged chain runs
// exactly as designed, but the value it commits was never a real, current
// upload.
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

    test('sets the widget filename to the temp location, but the preview must load once the report is fixed', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()
      const card = tab.getAssetCardByName(STALE_TEMP_CARD_TEXT)
      await expect(card).toBeVisible()

      const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
      await expect(loadImageNode).toBeVisible()

      // The literal stale temp reference must keep failing - that's the
      // report's defining condition, and it already happens for real
      // against the local backend (the file is gone). Any other resolution
      // - a fresh re-upload landing under a new name, or a fix that reads
      // straight from the asset's own persisted location - gets a real
      // image, since the RCA leaves the fix's shape open between those two.
      await comfyPage.page.route('**/view?**', async (route) => {
        const url = new URL(route.request().url())
        if (url.searchParams.get('filename') === STALE_TEMP_FILENAME) {
          return route.fallback()
        }
        return route.fulfill({ path: assetPath('test_upload_image.png') })
      })

      // Drop onto the canvas at the node's center, matching the working
      // asset-card-drag convention used elsewhere (see assets.spec.ts's
      // "Dragging outputs from assets skips upload"): the drop handler
      // lives on the canvas, not on the Vue node's own DOM element, so
      // dragging directly onto `loadImageNode` never resolves the drop.
      const targetPosition =
        await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
      if (!targetPosition) throw new Error('Load Image node center not found')
      // oxlint-disable-next-line playwright/no-force-option -- the Load Image Vue node's own DOM overlays the canvas at its center, so the canvas target never passes the actionability check without force.
      await card.dragTo(comfyPage.canvas, { targetPosition, force: true })

      const [loadImageNodeRef] =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
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

      // Expected to fail until the asset-panel-to-existing-node drop path
      // re-uploads (or otherwise verifies) the dragged file instead of
      // trusting the drag payload's original job location: the preview
      // 404s against the real, un-mocked stale path, showing a broken
      // image / "Image does not exist" instead of the picture.
      test.fail()
      await expect(
        loadImageNode.getByTestId(TestIds.node.mainImage)
      ).toBeVisible()
      await expect(
        loadImageNode.getByTestId(TestIds.errors.imageLoadError)
      ).toBeHidden()
    })
  }
)
