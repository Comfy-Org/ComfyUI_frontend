import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const NODE_CLIP_PADDING = 24

interface NodeEmphasisAssertions {
  expectEmphasized: () => Promise<void>
  expectIdle: () => Promise<void>
}

async function addKSamplerAndOpenAgent(
  comfyPage: ComfyPage,
  agentPanel: AgentPanel
) {
  await comfyPage.nodeOps.clearGraph()
  await comfyPage.nodeOps.addNode('KSampler', undefined, { x: 400, y: 300 })
  await comfyPage.nextFrame()
  await agentPanel.open()
  await agentPanel.selectWorkflow()
  await comfyPage.canvasOps.waitForViewToSettle()
}

async function cycleNodeMentionEmphasis(
  comfyPage: ComfyPage,
  agentPanel: AgentPanel,
  node: NodeEmphasisAssertions
) {
  const panel = agentPanel.root
  const nodeMention = panel.getByRole('menuitem', {
    name: 'KSampler',
    exact: true
  })
  const expectNothingSelected = () =>
    expect.poll(() => comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])
  const expectEmphasized = async () => {
    await expectNothingSelected()
    await node.expectEmphasized()
  }
  const expectIdle = async () => {
    await expectNothingSelected()
    await node.expectIdle()
  }

  await test.step('emphasizes the keyboard-active node without selecting it', async () => {
    await agentPanel.composer.fill('@')
    await panel
      .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
      .click()
    await agentPanel.composer.hover()
    await expect(nodeMention).toBeVisible()
    await expectIdle()

    await agentPanel.composer.press('ArrowDown')
    await expectEmphasized()

    await agentPanel.composer.press('ArrowUp')
    await expectIdle()
  })

  await test.step('emphasizes the hovered node without selecting it', async () => {
    await nodeMention.hover()
    await expectEmphasized()
  })

  await test.step('Escape removes the emphasis', async () => {
    await agentPanel.composer.press('Escape')
    await expect(nodeMention).toHaveCount(0)
    await comfyPage.nextFrame()
    await expectIdle()
  })
}

test.describe(
  'Agent node mention highlighting (legacy nodes)',
  { tag: ['@cloud', '@canvas', '@node', '@ui'] },
  () => {
    test.describe.configure({ timeout: 30_000 })
    test.use({ objectInfo: 'server' })

    test.beforeEach(async ({ agentPanel, comfyPage }) => {
      await addKSamplerAndOpenAgent(comfyPage, agentPanel)
    })

    test('highlights the active mention without changing graph selection', async ({
      agentPanel,
      comfyPage
    }) => {
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
          mask: [agentPanel.root],
          animations: 'disabled'
        })
      const idleNode = await screenshotNode()
      const looksIdle = async () => (await screenshotNode()).equals(idleNode)

      await cycleNodeMentionEmphasis(comfyPage, agentPanel, {
        expectEmphasized: () => expect.poll(looksIdle).toBe(false),
        expectIdle: () => expect.poll(looksIdle).toBe(true)
      })
    })
  }
)

test.describe(
  'Agent node mention highlighting (Vue nodes)',
  { tag: ['@cloud', '@canvas', '@node', '@ui', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 30_000 })
    test.use({ objectInfo: 'server' })

    test.beforeEach(async ({ agentPanel, comfyPage }) => {
      await addKSamplerAndOpenAgent(comfyPage, agentPanel)
    })

    test('highlights the active mention without changing graph selection', async ({
      agentPanel,
      comfyPage
    }) => {
      const vueNode = comfyPage.vueNodes.getNodeByTitle('KSampler').first()
      const stateOutline = vueNode.getByTestId('node-state-outline-overlay')

      await cycleNodeMentionEmphasis(comfyPage, agentPanel, {
        expectEmphasized: async () => {
          await expect(vueNode).toHaveAttribute('data-emphasized', 'true')
          await expect(stateOutline).toBeVisible()
        },
        expectIdle: async () => {
          await expect(vueNode).not.toHaveAttribute('data-emphasized', 'true')
          await expect(stateOutline).toBeHidden()
        }
      })
    })
  }
)
