import { expect } from '@playwright/test'

import { autogrowTest as test } from '@e2e/fixtures/agentAutogrowSpareInputFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * Covers the client-only API-node color and friendly autogrow label across a
 * CRDT catch-up after switching workflow tabs. The shared fixture owns the
 * same seeded workflow and lifecycle used by the spare-input regression spec;
 * this spec keeps only its distinct visual-state oracle.
 */

const IMAGE_1_NAME = 'model.images.image_1'
const IMAGE_1_FRIENDLY_LABEL = 'image_1'
const API_NODE_COLOR = { color: '#432', bgcolor: '#653' }

test.describe(
  'Agent CRDT autogrow node survives a tab switch',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('keeps the API node color and the autogrow input label after switching tabs away and back', async ({
      autogrow: { page, panel, vueNodes, gptNodeId, readNodeColor }
    }) => {
      await test.step('the node still shows its API-node color and friendly label', async () => {
        await expect.poll(readNodeColor).toEqual(API_NODE_COLOR)
        await expect(vueNodes.getInputSlotRow(gptNodeId, 0)).not.toContainText(
          IMAGE_1_NAME
        )
        await expect(vueNodes.getInputSlotRow(gptNodeId, 0)).toContainText(
          IMAGE_1_FRIENDLY_LABEL
        )
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()
        await expect(panel).toBeHidden()
        await page.getByTestId(TestIds.canvas.zoomControlsButton).click()
        await page.getByTestId(TestIds.canvas.zoomToFitAction).click()
        await page.keyboard.press('Escape')
        await expect(vueNodes.getNodeLocator(gptNodeId)).toBeInViewport({
          ratio: 1
        })
        await test.info().attach('reconciled-node', {
          body: await page.screenshot(),
          contentType: 'image/png'
        })
      })
    })
  }
)
