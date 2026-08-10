import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'

const SUBGRAPH_NODE_TITLE = 'New Subgraph'
const CLIP_TEXT_ENCODE_TITLE = 'CLIP Text Encode (Prompt)'
const MISSING_LINK_ID_ERROR = 'Missing Link ID when unpacking'

test.describe(
  'Subgraph unpack with unconnected input slots',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await expect(
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      ).toBeVisible()
    })

    test('does not log "Missing Link ID" for boundary links whose host input is unconnected', async ({
      comfyPage
    }) => {
      const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page,
        [MISSING_LINK_ID_ERROR]
      )

      try {
        await comfyPage.subgraph.unpackViaContextMenu(SUBGRAPH_NODE_TITLE)
        expect(warnings).toEqual([])
      } finally {
        dispose()
      }
    })

    test('keeps the promoted widget value when the host input is unconnected', async ({
      comfyPage
    }) => {
      const promotedText = comfyPage.vueNodes.getWidgetByName(
        SUBGRAPH_NODE_TITLE,
        'text'
      )
      await promotedText.fill('a painting of a hedgehog')
      await promotedText.blur()
      await expect(promotedText).toHaveValue('a painting of a hedgehog')

      await comfyPage.subgraph.unpackViaContextMenu(SUBGRAPH_NODE_TITLE)

      await expect(
        comfyPage.vueNodes.getWidgetByName(CLIP_TEXT_ENCODE_TITLE, 'text')
      ).toHaveValue('a painting of a hedgehog')
    })
  }
)
