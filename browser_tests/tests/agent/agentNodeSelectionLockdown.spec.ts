import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

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
      await comfyPage.command.executeCommand('Comfy.Queue.ToggleOverlay')
      const overlay = comfyPage.page.getByTestId('queue-progress-overlay')
      await expect(overlay).toBeVisible()

      await enterNodeSelectionMode(agentPanel, comfyPage.page)

      await comfyPage.page.screenshot({
        path: test
          .info()
          .outputPath('pm-1329-queue-overlay-hidden-in-selection-mode.png')
      })

      await expect(overlay).toHaveCount(0)

      await comfyPage.page
        .getByTestId('node-selection-mode-banner')
        .getByRole('button', { name: enMessages.agent.nodeSelection.exit })
        .click()

      await expect(overlay).toBeVisible()
    })

    test.describe('with Vue nodes', { tag: '@vue-nodes' }, () => {
      test.use({ objectInfo: 'server' })

      test('keeps Vue node widgets read-only while picking and still selects the clicked node', async ({
        agentPanel,
        comfyPage
      }) => {
        const page = comfyPage.page
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.nodeOps.addNode('CLIPTextEncode', undefined, {
          x: 200,
          y: 200
        })
        await comfyPage.vueNodes.waitForNodes()
        const node = comfyPage.vueNodes
          .getNodeByTitle('CLIP Text Encode (Prompt)')
          .first()
        const prompt = node.getByRole('textbox')
        await prompt.click()
        await page.keyboard.type('before')
        await expect(prompt).toHaveValue('before')

        await enterNodeSelectionMode(agentPanel, page)
        await expect(node).toBeInViewport()
        await node.getByTestId('node-title').hover()
        const promptBox = await prompt.boundingBox()
        if (!promptBox) throw new Error('prompt widget is not rendered')

        await page.mouse.click(
          promptBox.x + promptBox.width / 2,
          promptBox.y + promptBox.height / 2
        )
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(
          agentPanel.root.getByRole('button', {
            name: /Remove CLIP Text Encode \(Prompt\) #\d+ reference/
          })
        ).toBeVisible()
        expect(await page.evaluate(() => window.app!.canvas.selectOnly)).toBe(
          true
        )

        await page.keyboard.type('x')
        await expect(prompt).toHaveValue('before')
        await expect(prompt).not.toBeFocused()

        await page.keyboard.press('Escape')
        await expect(
          page.getByTestId('node-selection-mode-banner')
        ).toHaveCount(0)
        expect(await page.evaluate(() => window.app!.canvas.selectOnly)).toBe(
          false
        )
        await prompt.click()
        await page.keyboard.type('x')
        await expect(prompt).toHaveValue('beforex')
      })
    })
  }
)
