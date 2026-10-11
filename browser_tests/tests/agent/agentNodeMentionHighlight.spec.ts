import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const renderModes = [
  { name: 'legacy nodes', vueNodesEnabled: false },
  { name: 'Vue nodes', vueNodesEnabled: true }
] as const

for (const mode of renderModes) {
  test.describe(
    `Agent node mention highlighting (${mode.name})`,
    {
      tag: [
        '@cloud',
        '@canvas',
        '@node',
        '@ui',
        ...(mode.vueNodesEnabled ? ['@vue-nodes'] : [])
      ]
    },
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
        let highlightedCanvas = idleCanvas
        await expect
          .poll(async () => {
            highlightedCanvas = await comfyPage.canvas.screenshot({
              mask: [panel],
              animations: 'disabled'
            })
            return highlightedCanvas.equals(idleCanvas)
          })
          .toBe(false)
        if (mode.vueNodesEnabled) {
          await expect(
            comfyPage.vueNodes.getNodeByTitle('KSampler').first()
          ).toHaveClass(/outline-node-component-outline/)
        }

        await agentPanel.composer.press('Escape')
        await expect(nodeMention).toHaveCount(0)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              () => window.app!.canvas.highlighted_node_ids.size
            )
          )
          .toBe(0)
        await comfyPage.nextFrame()
        await expect
          .poll(async () => {
            const clearedCanvas = await comfyPage.canvas.screenshot({
              mask: [panel],
              animations: 'disabled'
            })
            return clearedCanvas.equals(highlightedCanvas)
          })
          .toBe(false)
        if (mode.vueNodesEnabled) {
          await expect(
            comfyPage.vueNodes.getNodeByTitle('KSampler').first()
          ).not.toHaveClass(/outline-node-component-outline/)
        }
      })
    }
  )
}
