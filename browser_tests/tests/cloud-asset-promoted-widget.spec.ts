import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  assetRequestIncludesTag,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import {
  STABLE_CHECKPOINT,
  STABLE_CHECKPOINT_2
} from '@e2e/fixtures/data/assetFixtures'
import { TestIds } from '@e2e/fixtures/selectors'
import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'missing/missing_model_promoted_widget'
const HOST_NODE_ID = toNodeId(2)
const WIDGET_NAME = 'ckpt_name'
const SELECTED_MODEL = STABLE_CHECKPOINT_2.name

const test = createCloudAssetsFixture([STABLE_CHECKPOINT, STABLE_CHECKPOINT_2])

interface WidgetSnapshot {
  type: string
  value: string
  hasLayout: boolean
}

async function getHostWidgetSnapshot(page: Page): Promise<WidgetSnapshot> {
  return await page.evaluate(
    ({ nodeId, widgetName }) => {
      const node = window.app!.graph.getNodeById(nodeId)
      const widget = node?.widgets?.find((widget) => widget.name === widgetName)

      return {
        type: widget?.type ?? '',
        value: String(widget?.value ?? ''),
        hasLayout: widget?.last_y != null
      }
    },
    { nodeId: HOST_NODE_ID, widgetName: WIDGET_NAME }
  )
}

test.describe(
  'Promoted subgraph asset widgets',
  { tag: ['@cloud', '@canvas', '@widget'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test('legacy asset browser selection updates the promoted host widget value', async ({
      cloudAssetRequests,
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      await expect
        .poll(
          () =>
            cloudAssetRequests.some((url) =>
              assetRequestIncludesTag(url, 'checkpoints')
            ),
          { timeout: 10_000 }
        )
        .toBe(true)
      await expect
        .poll(() => getHostWidgetSnapshot(comfyPage.page))
        .toMatchObject({
          type: 'asset',
          hasLayout: true
        })
      const initialWidget = await getHostWidgetSnapshot(comfyPage.page)
      expect(initialWidget.value).not.toBe(SELECTED_MODEL)

      const hostNode = await comfyPage.nodeOps.getNodeRefById(HOST_NODE_ID)
      await hostNode.centerOnNode()
      const promotedWidget = await hostNode.getWidgetByName(WIDGET_NAME)
      await promotedWidget.click()

      const modal = comfyPage.page.getByTestId(TestIds.assets.browserModal)
      await expect(modal).toBeVisible()

      const assetCard = modal
        .getByTestId(TestIds.assets.card)
        .filter({ hasText: SELECTED_MODEL })
        .first()
      await expect(assetCard).toBeVisible()
      await assetCard.getByRole('button', { name: 'Use' }).click()

      await expect(modal).toBeHidden()
      await expect
        .poll(() =>
          getHostWidgetSnapshot(comfyPage.page).then((widget) => widget.value)
        )
        .toBe(SELECTED_MODEL)
    })
  }
)
