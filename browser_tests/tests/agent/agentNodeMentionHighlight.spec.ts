import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent node mention highlighting',
  { tag: ['@cloud', '@canvas', '@node', '@ui'] },
  () => {
    test.describe.configure({ timeout: 30_000 })
    // Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/18397
    test.use({ objectInfo: 'server' })

    test.beforeEach(async ({ agentPanel, comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.nodeOps.addNode('KSampler', undefined, {
        x: 400,
        y: 300
      })
      await comfyPage.nextFrame()
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await comfyPage.canvasOps.waitForViewToSettle()
    })

    test('highlights the active mention without changing graph selection', async ({
      agentPanel,
      comfyPage
    }) => {
      const panel = agentPanel.root
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual([])
      const idleCanvas = await comfyPage.canvas.screenshot({
        mask: [panel],
        animations: 'disabled'
      })

      await agentPanel.composer.fill('@')
      await panel
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      const nodeMention = panel.getByRole('menuitem', {
        name: 'KSampler',
        exact: true
      })
      await nodeMention.hover()

      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual([])
      await expect
        .poll(async () => {
          const highlightedCanvas = await comfyPage.canvas.screenshot({
            mask: [panel],
            animations: 'disabled'
          })
          return highlightedCanvas.equals(idleCanvas)
        })
        .toBe(false)

      await agentPanel.composer.press('Escape')
      await expect(nodeMention).toHaveCount(0)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.canvas.highlighted_node_ids.size
          )
        )
        .toBe(0)
    })
  }
)
