import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph input values from upstream sources',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('edits a shared Primitive source without replacing either connection', async ({
      comfyMouse,
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-promoted-int-text-with-primitives'
      )
      const source = await comfyPage.nodeOps.getNodeRefById('3')
      const host = await comfyPage.nodeOps.getNodeRefById('1')
      const otherConsumer = await comfyPage.nodeOps.getNodeRefById('5')
      const reroute = await comfyPage.nodeOps.addNode('Reroute', undefined, {
        x: 360,
        y: 600
      })
      const panel = comfyPage.subgraph.inputPanel

      await test.step('Connect the String source through a reroute with two consumers', async () => {
        await comfyPage.vueNodes
          .getOutputSlotConnectionDot(String(source.id), 0)
          .dragTo(
            comfyPage.vueNodes.getInputSlotConnectionDot(String(reroute.id), 0)
          )
        await comfyPage.vueNodes
          .getOutputSlotConnectionDot(String(reroute.id), 0)
          .dragTo(
            comfyPage.vueNodes.getInputSlotConnectionDot(String(host.id), 0)
          )
        await comfyPage.vueNodes
          .getOutputSlotConnectionDot(String(reroute.id), 0)
          .dragTo(
            comfyPage.vueNodes.getInputSlotConnectionDot(
              String(otherConsumer.id),
              0
            )
          )
      })

      await test.step('Edit the owning Primitive from inside the subgraph', async () => {
        await comfyPage.vueNodes.enterSubgraph('1')
        await expect(panel.getByText(/← .* #3$/)).toBeVisible()
        await expect(
          panel.getByRole('img', { name: 'Shared source', exact: true })
        ).toBeVisible()
        await expect(
          panel.getByRole('textbox', { name: 'value', exact: true })
        ).toHaveValue('external prompt')
        await comfyPage.subgraph.fillInput('value', 'edited upstream source')
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
        await comfyMouse.clickCenter(
          panel.getByRole('spinbutton', { name: 'width', exact: true }),
          { button: 'right' }
        )
        await comfyPage.nextFrame()
        const { ariaMenu, litegraphMenu, litegraphContextMenu } =
          comfyPage.contextMenu
        await expect(
          ariaMenu.or(litegraphMenu).or(litegraphContextMenu)
        ).toBeHidden()
        expect(
          await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
        ).toEqual(before)
      })

      await test.step('Locating the source shows the same value and both links outside', async () => {
        await comfyPage.canvasOps.pan({ x: 300, y: 0 }, { x: 950, y: 420 })
        await panel
          .getByRole('button', { name: 'Locate source node', exact: true })
          .click()
        await expect(panel).toBeHidden()
        await expect(
          comfyPage.vueNodes
            .getNodeLocator('3')
            .getByRole('textbox', { name: 'value', exact: true })
        ).toHaveValue('edited upstream source')
        await (await source.getOutput(0)).expectLinkCount(1)
        await (await reroute.getOutput(0)).expectLinkCount(2)
        await (await host.getInput(0)).expectLinkCount(1)
        await (await otherConsumer.getInput(0)).expectLinkCount(1)
      })
    })
  }
)
