import type { Locator } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Subgraph input values during node picking',
  { tag: ['@subgraph', '@widget', '@cloud', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 30_000 })
    test.use({ objectInfo: 'server' })

    test('blocks the whole panel while picking and restores editing after exiting', async ({
      agentPanel,
      comfyPage
    }) => {
      const panel = comfyPage.page.getByTestId('subgraph-input-values')
      const input = panel.getByRole('textbox', {
        name: 'text',
        exact: true,
        includeHidden: true
      })
      const heading = panel.getByRole('heading', { includeHidden: true })
      const exit = panel.getByRole('button', {
        name: 'Exit subgraph',
        exact: true,
        includeHidden: true
      })
      const collapse = panel.getByRole('button', {
        name: 'Collapse',
        exact: true,
        includeHidden: true
      })

      async function clickThroughInertLayer(locator: Locator) {
        const box = await locator.boundingBox()
        if (!box) throw new Error('Expected the panel control to be rendered')
        await comfyPage.page.mouse.click(
          box.x + box.width / 2,
          box.y + box.height / 2
        )
      }

      await test.step('Edit the identified host before picking', async () => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/shared-definition-two-hosts-promoted-text'
        )
        await agentPanel.open()
        await agentPanel.selectWorkflow(
          'shared-definition-two-hosts-promoted-text'
        )
        await comfyPage.vueNodes.enterSubgraph('11')
        await expect(heading).toHaveText('Host A · #11')
        await input.fill('before-picking')
        await exit.focus()
      })

      const before = await comfyPage.nodeOps.getSerializedGraphWithoutViewport()

      await test.step('Picking blocks widgets, leaving the subgraph, and collapsing', async () => {
        await agentPanel.root
          .getByRole('button', { name: 'Add to prompt', exact: true })
          .click()
        await comfyPage.page
          .getByRole('menuitem', { name: 'Nodes', exact: true })
          .click()
        await expect(agentPanel.nodeSelectionBanner).toBeVisible()
        await comfyPage.canvasOps.waitForViewToSettle()
        const bounds = await panel.boundingBox()
        if (!bounds) throw new Error('Expected the input node to be rendered')
        await comfyPage.canvasOps.pan(
          { x: 96 - bounds.x, y: 220 - bounds.y },
          { x: 600, y: 650 }
        )
        await expect(collapse).toBeInViewport()
        await expect(panel).toHaveAttribute('inert', '')
        await clickThroughInertLayer(input)
        await comfyPage.page.keyboard.type('x')
        await expect(input).not.toBeFocused()
        await expect(input).toHaveValue('before-picking')
        const graphId = await comfyPage.subgraph.getActiveGraphId()
        await clickThroughInertLayer(
          exit.getByText('Exit subgraph', { exact: true })
        )
        expect(await comfyPage.subgraph.getActiveGraphId()).toBe(graphId)
        await expect(heading).toHaveText('Host A · #11')
        await clickThroughInertLayer(collapse)
        await expect(collapse).toHaveAttribute('aria-expanded', 'true')
        await expect(input).toBeVisible()
        expect(
          await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
        ).toEqual(before)
      })

      await test.step('Exiting restores editing and panel controls', async () => {
        await agentPanel.exitNodeSelectionMode()
        await input.fill('after-picking')
        await exit.focus()
        await expect(input).toHaveValue('after-picking')
        await collapse.click()
        await expect(input).toHaveCount(0)
        await panel.getByRole('button', { name: 'Expand', exact: true }).click()
        await expect(input).toHaveValue('after-picking')
        await exit.getByText('Exit subgraph', { exact: true }).click()
        await expect(panel).toBeHidden()
        await comfyPage.vueNodes.enterSubgraph('12')
        await expect(heading).toHaveText('Host B · #12')
        await expect(input).toHaveValue('')
      })
    })
  }
)
