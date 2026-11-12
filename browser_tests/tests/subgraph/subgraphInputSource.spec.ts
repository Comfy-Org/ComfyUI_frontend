import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe(
  'Subgraph input values from upstream sources',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('edits a shared Primitive source without replacing either connection', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-promoted-int-text-with-primitives'
      )
      const source = await comfyPage.nodeOps.getNodeRefById('3')
      const host = await comfyPage.nodeOps.getNodeRefById('1')
      const otherConsumer = await comfyPage.nodeOps.getNodeRefById('5')
      const panel = comfyPage.page.getByTestId('subgraph-input-values')

      await test.step('Connect the String source to the host and another consumer', async () => {
        await source.connectOutput(0, host, 0)
        await source.connectOutput(0, otherConsumer, 0)
        await (await source.getOutput(0)).expectLinkCount(2)
      })

      await test.step('Edit the owning Primitive from inside the subgraph', async () => {
        await comfyPage.vueNodes.enterSubgraph('1')
        await expect(panel.getByText(/Source: .* · #3$/)).toBeVisible()
        const input = panel.getByRole('textbox', { name: 'value', exact: true })
        await expect(input).toHaveValue('external prompt')
        await input.fill('edited upstream source')
        await panel
          .getByRole('combobox', { name: 'Editing values for' })
          .focus()
      })

      await test.step('Right-clicking a boundary widget does not open the selected interior node menu', async () => {
        const interior = await comfyPage.nodeOps.getNodeRefByType(
          'CLIPTextEncode',
          true
        )
        await comfyPage.vueNodes
          .getNodeLocator(String(interior.id))
          .getByTestId('node-title')
          .click()
        await expect
          .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
          .toEqual([interior.id])
        const before =
          await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
        await panel
          .getByRole('group', { name: 'width', exact: true })
          .getByTestId(TestIds.widgets.widget)
          .click({ button: 'right' })
        await comfyPage.nextFrame()
        await comfyPage.contextMenu.waitForHidden()
        expect(
          await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
        ).toEqual(before)
      })

      await test.step('Locating the source shows the same value and both links outside', async () => {
        await panel
          .getByRole('button', { name: 'Locate source node', exact: true })
          .click()
        await expect(panel).toBeHidden()
        await expect(
          comfyPage.vueNodes
            .getNodeLocator('3')
            .getByRole('textbox', { name: 'value', exact: true })
        ).toHaveValue('edited upstream source')
        await (await source.getOutput(0)).expectLinkCount(2)
        await (await host.getInput(0)).expectLinkCount(1)
        await (await otherConsumer.getInput(0)).expectLinkCount(1)
      })
    })
  }
)
