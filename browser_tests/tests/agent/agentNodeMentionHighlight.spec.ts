import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const renderModes = [
  { name: 'legacy nodes', vueNodesEnabled: false },
  { name: 'Vue nodes', vueNodesEnabled: true }
] as const

const NODE_CLIP_PADDING = 24

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
        const nodeMention = panel.getByRole('menuitem', {
          name: 'KSampler',
          exact: true
        })

        const bounds = await (
          await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
        ).getBounding()
        const clip = await comfyPage.page.evaluate(
          ({ x, y, width, height, padding }) => {
            const [left, top] = window.app!.canvasPosToClientPos([x, y])
            const [right, bottom] = window.app!.canvasPosToClientPos([
              x + width,
              y + height
            ])
            return {
              x: left - padding,
              y: top - padding,
              width: right - left + padding * 2,
              height: bottom - top + padding * 2
            }
          },
          { ...bounds, padding: NODE_CLIP_PADDING }
        )

        const screenshotNode = () =>
          comfyPage.page.screenshot({
            clip,
            mask: [panel],
            animations: 'disabled'
          })

        const idleNode = await screenshotNode()

        const expectEmphasized = async (emphasized: boolean) => {
          await expect
            .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
            .toEqual([])
          await expect
            .poll(async () => (await screenshotNode()).equals(idleNode))
            .toBe(!emphasized)
          if (mode.vueNodesEnabled) {
            const vueNode = comfyPage.vueNodes
              .getNodeByTitle('KSampler')
              .first()
            if (emphasized)
              await expect(vueNode).toHaveClass(/outline-foreground/)
            else await expect(vueNode).not.toHaveClass(/outline-foreground/)
          }
        }

        await test.step('emphasizes the keyboard-active node without selecting it', async () => {
          await agentPanel.composer.fill('@')
          await panel
            .getByRole('menuitem', {
              name: enMessages.agent.nodes,
              exact: true
            })
            .click()
          // Park the pointer off the menu so only the keyboard moves the active row.
          await agentPanel.composer.hover()
          await expect(nodeMention).toBeVisible()
          await expectEmphasized(false)

          await agentPanel.composer.press('ArrowDown')
          await expectEmphasized(true)

          await agentPanel.composer.press('ArrowUp')
          await expectEmphasized(false)
        })

        await test.step('emphasizes the hovered node without selecting it', async () => {
          await nodeMention.hover()
          await expectEmphasized(true)
        })

        await test.step('Escape removes the emphasis', async () => {
          await agentPanel.composer.press('Escape')
          await expect(nodeMention).toHaveCount(0)
          await comfyPage.nextFrame()
          await expectEmphasized(false)
        })
      })
    }
  )
}
