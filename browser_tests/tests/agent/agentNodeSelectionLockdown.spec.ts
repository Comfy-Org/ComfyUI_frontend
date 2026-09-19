import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// PM-1329 (child of PM-995): node selection mode left the canvas info
// overlay (`useLitegraphSettings.ts:19-31`, gated only on
// `Comfy.Graph.CanvasInfo`) and the floating queue overlay
// (`TopMenuSection.vue`'s `isQueueProgressOverlayEnabled`, gated only on
// `isQueuePanelV2Enabled`) visible with no selection-mode check. Both are
// now fixed in `agentNodeSelectionStore.ts` / `TopMenuSection.vue`. The
// cases below cover those two symptoms, using the same real-UI entry (Add
// to prompt -> Nodes) as the existing "exits node selection when the
// active workflow changes" test in agentPanel.spec.ts.
//
// Widget edits and canvas.read_only are deliberately not symptoms here:
// entering selection mode already sets `canvas.selectOnly = true`
// (AgentPanelRoot.vue's onSelectNodes), and `LGraphCanvas.ts`'s
// `_processNodeClick` returns before any widget/collapse/io handling
// whenever `selectOnly` is set (~line 2755; covered by
// `LGraphCanvas.selectOnly.test.ts`). Pinning `canvas.read_only` as well
// was tried and reverted: `_processPrimaryButton` and
// `useCanvasInteractions.ts`'s `shouldHandleNodePointerEvents` both
// early-return on `read_only`, which turns node-click-to-select itself
// into a no-op - the opposite of what selection mode needs.
async function enterNodeSelectionMode(
  agentPanel: AgentPanel,
  page: Page
): Promise<void> {
  await agentPanel.open()
  await agentPanel.selectWorkflow()
  await agentPanel.root
    .getByRole('button', { name: enMessages.agent.addToPrompt })
    .click()
  await page.getByRole('menuitem', { name: enMessages.agent.nodes }).click()
  await expect(page.getByTestId('node-selection-mode-banner')).toBeVisible()
}

test.describe(
  'Agent node selection mode lockdown (PM-1329)',
  { tag: '@cloud' },
  () => {
    test('hides the canvas info overlay while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Graph.CanvasInfo', true)
      await comfyPage.nextFrame()
      expect(
        await comfyPage.page.evaluate(() => window.app!.canvas.show_info),
        'Precondition: canvas info overlay is enabled'
      ).toBe(true)

      await enterNodeSelectionMode(agentPanel, comfyPage.page)
      await comfyPage.nextFrame()

      await comfyPage.page.screenshot({
        path: test
          .info()
          .outputPath(
            'pm-1329-canvas-info-overlay-visible-in-selection-mode.png'
          )
      })

      expect(
        await comfyPage.page.evaluate(() => window.app!.canvas.show_info)
      ).toBe(false)
    })

    test('hides the floating queue overlay while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', false)

      await enterNodeSelectionMode(agentPanel, comfyPage.page)

      await comfyPage.command.executeCommand('Comfy.Queue.ToggleOverlay')
      const overlay = comfyPage.page.getByTestId('queue-progress-overlay')
      await expect(overlay).toBeVisible()

      await comfyPage.page.screenshot({
        path: test
          .info()
          .outputPath('pm-1329-queue-overlay-visible-in-selection-mode.png')
      })

      await expect(overlay).toHaveCount(0)
    })
  }
)
