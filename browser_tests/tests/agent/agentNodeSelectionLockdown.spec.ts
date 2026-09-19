import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// PM-1329 (child of PM-995): node selection mode does not lock down the
// canvas. `agentNodeSelectionStore.ts`'s enter()/exit() never touch
// `canvas.read_only` (src/stores/agentNodeSelectionStore.ts), unlike the
// app-mode precedent in `appModeStore.ts`'s `enforceReadOnly`
// (src/stores/appModeStore.ts:252-261). The canvas info overlay
// (`useLitegraphSettings.ts:19-31`, gated only on `Comfy.Graph.CanvasInfo`)
// and the floating queue overlay (`TopMenuSection.vue`'s
// `isQueueProgressOverlayEnabled`, gated only on `isQueuePanelV2Enabled`)
// have no selection-mode check either. One root-cause class, three
// symptoms. Each `test.fail()` case below pins one symptom until PM-1329
// lands, using the same real-UI entry (Add to prompt -> Nodes) as the
// existing "exits node selection when the active workflow changes" test in
// agentPanel.spec.ts.
//
// Widget edits are deliberately not one of the symptoms here: entering
// selection mode also sets `canvas.selectOnly = true` (AgentPanelRoot.vue's
// onSelectNodes), and `LGraphCanvas.ts`'s `_processNodeClick` returns before
// any widget/collapse/io handling whenever `selectOnly` is set (~line 2755;
// covered by `LGraphCanvas.selectOnly.test.ts`). Widgets are already
// undraggable during node selection today, independent of the missing
// `read_only` lockdown, so a "steps widget stays draggable" case would not
// reproduce a real bug.
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
    test('keeps the canvas read-only while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      expect(
        await comfyPage.canvasOps.isReadOnly(),
        'Precondition: canvas starts writable'
      ).toBe(false)

      await enterNodeSelectionMode(agentPanel, comfyPage.page)

      test.fail(
        true,
        'PM-1329: agentNodeSelectionStore never sets canvas.read_only, so the canvas stays writable during node selection mode'
      )
      expect(await comfyPage.canvasOps.isReadOnly()).toBe(true)
    })

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

      test.fail(
        true,
        'PM-1329: useLitegraphSettings only gates show_info on Comfy.Graph.CanvasInfo, with no selection-mode check'
      )
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

      test.fail(
        true,
        'PM-1329: TopMenuSection only gates QueueProgressOverlay on isQueuePanelV2Enabled, with no selection-mode check'
      )
      await expect(overlay).toHaveCount(0)
    })
  }
)
