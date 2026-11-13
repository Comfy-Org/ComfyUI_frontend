import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe(
  'Subgraph input widget lifecycle',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('creates a widget input from the empty socket and disconnects it with Ctrl+Alt click', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const sampler = await comfyPage.nodeOps.getNodeRefByType('KSampler', true)
      const samplerSteps = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(String(sampler.id))
      ).getSlot('steps')
      const { inputPanel, inputPorts, addInputSocket } = comfyPage.subgraph
      const steps = comfyPage.subgraph.inputSocket('steps')
      const stepsWidget = inputPanel.getByRole('spinbutton', {
        name: 'steps',
        exact: true
      })

      await test.step('Dragging the empty socket to a widget input creates its native promoted control', async () => {
        await addInputSocket.dragTo(samplerSteps)
        await expect(inputPorts).toHaveCount(7)
        await expect(stepsWidget).toHaveValue('20')
        await expect(addInputSocket).toHaveCount(1)
      })

      await test.step('Ctrl+Alt clicking the port disconnects its link', async () => {
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(samplerSteps))
          .toBe(true)
        await steps.click({ modifiers: ['Control', 'Alt'] })
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(samplerSteps))
          .toBe(false)
        await expect(steps).toHaveCount(1)
        await expect(stepsWidget).toHaveCount(0)
      })
    })
  }
)
