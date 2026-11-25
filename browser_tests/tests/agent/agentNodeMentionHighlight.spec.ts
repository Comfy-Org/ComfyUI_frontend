import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  canvasNodeEmphasis,
  vueNodeEmphasis
} from '@e2e/fixtures/helpers/NodeEmphasisHelper'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

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
        const isEmphasized = await mode.emphasisCheck(
          comfyPage,
          'KSampler',
          panel
        )

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
