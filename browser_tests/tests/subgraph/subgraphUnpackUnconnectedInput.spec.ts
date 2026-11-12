import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'

test.describe(
  'Subgraph unpack with unconnected input slots',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    const SUBGRAPH_NODE_TITLE = 'New Subgraph'
    const CLIP_TEXT_ENCODE_TITLE = 'CLIP Text Encode (Prompt)'
    const UNPACK_BOUNDARY_ERRORS = [
      'Missing Link ID when unpacking',
      'Missing host input when unpacking subgraph'
    ]
    const PROMPT_TEXT = 'a painting of a hedgehog'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await expect(
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      ).toBeVisible()
    })

    test('does not log an unpack error for boundary links whose host input is unconnected', async ({
      comfyPage
    }) => {
      const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page,
        UNPACK_BOUNDARY_ERRORS
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
      await promotedText.fill(PROMPT_TEXT)
      await promotedText.blur()
      await expect(promotedText).toHaveValue(PROMPT_TEXT)

      await comfyPage.subgraph.unpackViaContextMenu(SUBGRAPH_NODE_TITLE)

      await expect(
        comfyPage.vueNodes.getWidgetByName(CLIP_TEXT_ENCODE_TITLE, 'text')
      ).toHaveValue(PROMPT_TEXT)
    })

    test('restores the promoted widget value when the unpack is undone, and re-applies it on redo', async ({
      comfyPage
    }) => {
      const promotedText = comfyPage.vueNodes.getWidgetByName(
        SUBGRAPH_NODE_TITLE,
        'text'
      )
      await promotedText.fill(PROMPT_TEXT)
      await promotedText.blur()
      await expect(promotedText).toHaveValue(PROMPT_TEXT)

      await comfyPage.subgraph.unpackViaContextMenu(SUBGRAPH_NODE_TITLE)
      await comfyPage.keyboard.undo()

      await expect(
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      ).toBeVisible()
      await expect(
        comfyPage.vueNodes.getWidgetByName(SUBGRAPH_NODE_TITLE, 'text')
      ).toHaveValue(PROMPT_TEXT)

      await comfyPage.keyboard.redo()

      await expect(
        comfyPage.vueNodes.getWidgetByName(CLIP_TEXT_ENCODE_TITLE, 'text')
      ).toHaveValue(PROMPT_TEXT)
    })
  }
)
