import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addGreenLoadImageNode,
  setNodeTitle
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'
import { TestIds } from '@e2e/fixtures/selectors'
import { nextFrame } from '@e2e/fixtures/utils/timing'

test.describe(
  'A local node colour survives an agent edit to the same node',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test(
      'recolouring a node mid-turn is not reverted when the agent renames it',
      {
        annotation: [
          {
            type: 'issue',
            description:
              'https://linear.app/comfyorg/issue/FE-3494/crdt-sync-local-node-colourshapeproperties-edits-are-not-written-back'
          }
        ]
      },
      async ({ page }) => {
        const nodeId = AGENT_NODE_IDS[0]
        const renamedTitle = 'Reference Image'
        const agent = new AgentRemoteApplyHarness(page)
        const wrapper = agent.vueNodes.getNodeInnerWrapper(String(nodeId))
        const background = () =>
          wrapper.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )

        await agent.setUp()
        await agent.openAndTarget()
        await agent.sendPrompt('add a load image node and name it')
        await agent.hostSocket.waitForSubscribe()

        agent.reportToolCall('add_node', 'call-add')
        agent.applyAndBroadcast([addGreenLoadImageNode(nodeId, 0)])
        await expect(agent.node(nodeId)).toBeVisible()
        const agentBackground = await background()

        await agent.vueNodes.selectNode(String(nodeId))
        await page
          .getByTestId(TestIds.selectionToolbox.colorPickerButton)
          .dispatchEvent('click')
        await page
          .getByTestId(TestIds.selectionToolbox.colorRed)
          .dispatchEvent('click')
        await expect.poll(background).not.toBe(agentBackground)
        const userBackground = await background()

        agent.reportToolCall('set_node_field', 'call-rename')
        agent.applyAndBroadcast([setNodeTitle(nodeId, renamedTitle)])
        agent.finishTurn('Added a Load Image node named Reference Image.')
        await expect(agent.node(nodeId)).toContainText(renamedTitle)
        await nextFrame(page)

        test.fail()
        await expect(wrapper).toHaveCSS('background-color', userBackground)
      }
    )
  }
)
