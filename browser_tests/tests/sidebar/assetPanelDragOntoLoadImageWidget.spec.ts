import type { Asset } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

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
  id: 'stale-temp-preview-001',
  name: STALE_TEMP_FILENAME,
  job_id: 'job-stale-temp-001',
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

    test('sets the widget filename but the preview fails to load, instead of uploading the file', async ({
      comfyPage
    }) => {
      // Expected to fail until the asset-panel-to-existing-node drop path
      // re-uploads (or otherwise verifies) the dragged file instead of
      // trusting the drag payload's original job location.
      test.fail()

      const uploadRequests: string[] = []
      await comfyPage.page.route('**/upload/image', async (route) => {
        uploadRequests.push(route.request().url())
        await route.fallback()
      })

      const tab = comfyPage.menu.assetsTab
      await tab.open()
      const card = tab.getAssetCardByName(STALE_TEMP_CARD_TEXT)
      await expect(card).toBeVisible()

      const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
      await expect(loadImageNode).toBeVisible()

      await card.dragTo(loadImageNode)

      const [loadImageNodeRef] =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      const imageWidget = await loadImageNodeRef.getWidgetByName('image')

      // The widget value updates immediately, exactly matching the report:
      // "it changed the image file name correctly so I assume it is loaded".
      await expect
        .poll(() => imageWidget.getValue())
        .toBe(`${STALE_TEMP_FILENAME} [temp]`)

      // But nothing ever uploaded the dragged file - the drop path bypassed
      // the real upload flow entirely.
      expect(uploadRequests).toEqual([])

      // ...so the preview 404s: broken image / "Image does not exist".
      await expect(
        loadImageNode.getByTestId(TestIds.errors.imageLoadError)
      ).toBeVisible()
    })
  }
)
