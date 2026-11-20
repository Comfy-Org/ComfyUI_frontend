import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

type EmphasisCheck = (emphasized: boolean) => Promise<void>

const NODE_CLIP_PADDING = 24

async function canvasNodeEmphasis(
  comfyPage: ComfyPage,
  panel: Locator
): Promise<EmphasisCheck> {
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

  return async (emphasized) => {
    await expect
      .poll(async () => (await screenshotNode()).equals(idleNode))
      .toBe(!emphasized)
  }
}

async function vueNodeEmphasis(comfyPage: ComfyPage): Promise<EmphasisCheck> {
  const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

  return async (emphasized) => {
    await expect(comfyPage.vueNodes.emphasizedNodes).toHaveCount(
      emphasized ? 1 : 0
    )
    await expect(node.stateOutline).toBeVisible({ visible: emphasized })
  }
}

const renderModes = [
  {
    name: 'legacy nodes',
    vueNodesEnabled: false,
    emphasisCheck: canvasNodeEmphasis
  },
  {
    name: 'Vue nodes',
    vueNodesEnabled: true,
    emphasisCheck: vueNodeEmphasis
  }
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
        const isEmphasized = await mode.emphasisCheck(comfyPage, panel)

        const expectEmphasized = async (emphasized: boolean) => {
          await expect
            .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
            .toEqual([])
          await isEmphasized(emphasized)
        }

        await test.step('emphasizes the keyboard-active node without selecting it', async () => {
          await agentPanel.composer.fill('@')
          await panel
            .getByRole('menuitem', {
              name: enMessages.agent.nodes,
              exact: true
            })
            .click()
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
