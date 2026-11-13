import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe(
  'Subgraph input widget lifecycle',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('creates a widget input from the empty socket and disconnects its fanout with Ctrl+Alt click', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const first = await comfyPage.nodeOps.getNodeRefByType('KSampler', true)
      await comfyPage.searchBoxV2.addNode('KSampler', {
        position: { x: 950, y: 350 }
      })
      const samplers = await comfyPage.nodeOps.getNodeRefsByType(
        'KSampler',
        true
      )
      const second = samplers.find((node) => node.id !== first.id)
      if (!second)
        throw new Error('Expected the second KSampler from node search')
      const firstSteps = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(String(first.id))
      ).getSlot('steps')
      const secondSteps = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(String(second.id))
      ).getSlot('steps')
      const { inputPanel, inputPorts, addInputSocket } = comfyPage.subgraph
      const steps = comfyPage.subgraph.inputSocket('steps')
      const stepsWidget = inputPanel.getByRole('spinbutton', {
        name: 'steps',
        exact: true
      })

      await test.step('Dragging the empty socket to a widget input creates its native promoted control', async () => {
        await addInputSocket.dragTo(firstSteps)
        await expect(inputPorts).toHaveCount(7)
        await expect(stepsWidget).toHaveValue('20')
        await expect(addInputSocket).toHaveCount(1)
      })

      await test.step('Ctrl+Alt clicking a port that feeds two widgets disconnects both links', async () => {
        await steps.dragTo(secondSteps)
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(firstSteps))
          .toBe(true)
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(secondSteps))
          .toBe(true)
        await steps.click({ modifiers: ['Control', 'Alt'] })
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(firstSteps))
          .toBe(false)
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(secondSteps))
          .toBe(false)
        await expect(steps).toHaveCount(1)
        await expect(stepsWidget).toHaveCount(0)
      })
    })
  }
)
