/**
 * FE-230: Deleting an asset must clear the Load Image node preview, widget
 * value, and mark the workflow dirty.
 *
 * Local run (requires cloud build of the frontend):
 *   pnpm build:cloud
 *   pnpm exec playwright test --project=cloud \
 *     browser_tests/tests/assetDeleteClearsLoadImage.spec.ts --reporter=list
 *
 * The cloud project is required because input-asset deletion is gated on
 * `isCloud === true` (see `useMediaAssetActions.deleteAssetApi`).
 */
import type { Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  STABLE_CHECKPOINT,
  STABLE_INPUT_IMAGE
} from '@e2e/fixtures/data/assetFixtures'

// The asset name must match the dropped file so that the deletion flow's
// widget-value matching (name + `name [input]`) actually targets the same
// value the drag-and-drop set on the Load Image widget.
const DROPPED_FILE = 'image64x64.webp'
const TARGET_ASSET: Asset = {
  ...STABLE_INPUT_IMAGE,
  name: DROPPED_FILE,
  mime_type: 'image/webp'
}
const SEEDED_ASSETS: Asset[] = [STABLE_CHECKPOINT, TARGET_ASSET]
// MediaAssetCard renders the basename without extension, so card-text
// matching uses the stripped form.
const TARGET_CARD_TEXT = TARGET_ASSET.name.replace(/\.[^.]+$/, '')

type AssetMockApi = {
  readonly deleteCalls: ReadonlyArray<string>
}

const assetMockByPage = new WeakMap<Page, { deleteCalls: string[] }>()

function filterByTags(assets: Asset[], url: URL): Asset[] {
  const includeTags = parseTagParam(url.searchParams.get('include_tags'))
  const excludeTags = parseTagParam(url.searchParams.get('exclude_tags'))
  return assets.filter(
    (asset) =>
      includeTags.every((tag) => (asset.tags ?? []).includes(tag)) &&
      excludeTags.every((tag) => !(asset.tags ?? []).includes(tag))
  )
}

function parseTagParam(value: string | null): string[] {
  return (
    value
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  )
}

// Narrow the route patterns to the cloud API endpoints we actually want to
// intercept. Using a broader pattern (e.g. `**/assets**`) collides with the
// cloud build's static bundle paths under `/assets/*.js` and starves the app
// of its own JavaScript, leaving it stuck on the loading splash.
async function registerAssetMocks(
  page: Page,
  assets: Asset[],
  deleteCalls: string[]
): Promise<void> {
  await page.route(/\/api\/assets(?:\?.*)?$/, (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const url = new URL(route.request().url())
    const filtered = filterByTags(assets, url)
    const body: ListAssetsResponse = {
      assets: filtered,
      total: filtered.length,
      has_more: false
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })

  await page.route(/\/api\/assets\/([^/?#]+)$/, (route: Route) => {
    const method = route.request().method()
    const id = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    if (method === 'DELETE') {
      deleteCalls.push(id)
      return route.fulfill({ status: 204, body: '' })
    }
    if (method === 'GET') {
      const found = assets.find((asset) => asset.id === id)
      if (found) return route.fulfill({ status: 200, json: found })
      return route.fulfill({ status: 404, json: { error: 'Not found' } })
    }
    return route.fallback()
  })
}

const baseTest = comfyPageFixture.extend<{ assetMock: AssetMockApi }>({
  page: async ({ page }, use) => {
    const deleteCalls: string[] = []
    await registerAssetMocks(page, SEEDED_ASSETS, deleteCalls)
    assetMockByPage.set(page, { deleteCalls })
    await use(page)
    assetMockByPage.delete(page)
  },
  assetMock: async ({ page }, use) => {
    const state = assetMockByPage.get(page)
    if (!state) throw new Error('assetMock state missing for page')
    await use({
      get deleteCalls() {
        return state.deleteCalls
      }
    })
  }
})

baseTest.describe(
  'FE-230 asset delete clears Load Image preview',
  { tag: '@cloud' },
  () => {
    baseTest(
      'deleting an input asset clears widget value, preview cache, and marks workflow modified',
      async ({ comfyPage, assetMock }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

        // Drive the production drag-and-drop flow to point the Load Image
        // widget at the asset we are about to delete and populate the preview
        // cache. FE-230 is asserting that the deletion tears these down.
        const loadImageNode = (
          await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
        )[0]
        const { x, y } = await loadImageNode.getPosition()
        await comfyPage.dragDrop.dragAndDropFile(DROPPED_FILE, {
          dropPosition: { x, y },
          waitForUpload: true
        })
        const imageWidget = await loadImageNode.getWidget(0)
        await expect.poll(() => imageWidget.getValue()).toBe(DROPPED_FILE)

        // Re-baseline the change tracker so the deletion-side mutation is the
        // only thing that can flip `isModified` later.
        await comfyPage.page.evaluate(() => {
          const tracker =
            window.app?.extensionManager?.workflow?.activeWorkflow
              ?.changeTracker
          tracker?.reset?.()
        })
        await expect
          .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
          .toBe(false)

        // Drive the real production flow: assets sidebar → Imported tab →
        // right-click asset card → Delete → confirm dialog.
        const sidebar = comfyPage.menu.assetsTab
        // The default `open()` waits for assets on the Generated tab; we seed
        // only an input asset, so skip that wait and let `waitForAssets(1)`
        // gate on the Imported tab instead.
        await sidebar.open({ waitForAssets: false })
        await sidebar.switchToImported()
        await sidebar.waitForAssets(1)
        await sidebar.rightClickAsset(TARGET_CARD_TEXT)

        const deleteMenuItem = sidebar.contextMenuItem('Delete')
        await expect(deleteMenuItem).toBeVisible()
        await deleteMenuItem.click()

        await comfyPage.confirmDialog.click('delete')

        // Mocked DELETE was issued.
        await expect
          .poll(() => assetMock.deleteCalls.includes(TARGET_ASSET.id))
          .toBe(true)

        // Widget value was cleared.
        await expect.poll(() => imageWidget.getValue()).toBe('')

        // Preview cache was cleared.
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.getNodeById(nodeId)
              return node?.imgs?.length ?? 0
            }, loadImageNode.id)
          )
          .toBe(0)

        // Workflow was marked dirty by changeTracker.captureCanvasState().
        await expect
          .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
          .toBe(true)
      }
    )
  }
)
