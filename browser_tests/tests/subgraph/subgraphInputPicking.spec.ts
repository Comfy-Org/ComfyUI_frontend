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
      comfyMouse,
      comfyPage
    }) => {
      const { inputPanel, exitButton } = comfyPage.subgraph
      const input = inputPanel.getByRole('textbox', {
        name: 'text',
        exact: true,
        includeHidden: true
      })

      await test.step('Edit the identified host before picking', async () => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/shared-definition-two-hosts-promoted-text'
        )
        await agentPanel.open()
        await agentPanel.selectWorkflow(
          'shared-definition-two-hosts-promoted-text'
        )
        await comfyPage.vueNodes.enterSubgraph('11')
        await comfyPage.subgraph.fillInput('text', 'before-picking')
      })

      const before = await comfyPage.nodeOps.getSerializedGraphWithoutViewport()

      await test.step('Picking blocks widgets and leaving the subgraph', async () => {
        await agentPanel.root
          .getByRole('button', { name: 'Add to prompt', exact: true })
          .click()
        await comfyPage.page
          .getByRole('menuitem', { name: 'Nodes', exact: true })
          .click()
        await expect(agentPanel.nodeSelectionBanner).toBeVisible()
        await comfyPage.canvasOps.waitForViewToSettle()
        const bounds = await inputPanel.boundingBox()
        if (!bounds) throw new Error('Expected the input node to be rendered')
        await comfyPage.canvasOps.pan(
          { x: 96 - bounds.x, y: 220 - bounds.y },
          { x: 600, y: 650 }
        )
        await expect(input).toBeInViewport()
        await comfyMouse.clickCenter(input)
        await comfyPage.page.keyboard.type('x')
        await expect(input).not.toBeFocused()
        await expect(input).toHaveValue('before-picking')
        const graphId = await comfyPage.subgraph.getActiveGraphId()
        await comfyMouse.clickCenter(
          exitButton.getByText('Exit subgraph', { exact: true })
        )
        expect(await comfyPage.subgraph.getActiveGraphId()).toBe(graphId)
        expect(
          await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
        ).toEqual(before)
      })

      await test.step('Exiting picking restores editing', async () => {
        await agentPanel.exitNodeSelectionMode()
        await comfyPage.subgraph.fillInput('text', 'after-picking')
        await expect(input).toHaveValue('after-picking')
      })
    })
  }
)
