import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addLoadImageNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'
import { TestIds } from '@e2e/fixtures/selectors'

const [NODE_ID] = AGENT_NODE_IDS
const RENAMED_TITLE = 'Reference Image'

/** `LGraphCanvas.node_colors.green`, so the document holds a palette colour. */
function addGreenLoadImageNode(): RecordedGraphOperation {
  const add = addLoadImageNode(NODE_ID, 0)
  const node = add.node as Record<string, unknown>
  return { ...add, node: { ...node, color: '#232', bgcolor: '#353' } }
}

function renameNode(title: string): RecordedGraphOperation {
  return {
    op: 'set_node_field',
    node_id: NODE_ID,
    field: 'title',
    value: title
  }
}

// FE-3494: colour, shape and `properties` have no write-back op, yet the
// follower re-applies them from the document whenever the document edits that
// node. Every new turn re-mints the document from the posted canvas, so an edit
// made before the prompt survives; this pins the window that remains, a user
// recolouring a node while the agent's turn is still editing it.
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
        // Expected failure until colour/shape/properties gain a write-back op
        // (comfy-multi-player WRITABLE_NODE_FIELDS, comfy-cli, cloud sidecar,
        // then the frontend intent). Remove this line with that fix.
        test.fail()

        const agent = new AgentRemoteApplyHarness(page)
        const wrapper = agent.vueNodes.getNodeInnerWrapper(String(NODE_ID))
        const background = () =>
          wrapper.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )

        await agent.setUp()
        await agent.openAndTarget()
        await agent.sendPrompt('add a load image node and name it')
        await agent.hostSocket.waitForSubscribe()

        agent.reportToolCall('add_node', 'call-add')
        agent.applyAndBroadcast([addGreenLoadImageNode()])
        await expect(agent.node(NODE_ID)).toBeVisible()
        const agentBackground = await background()

        await agent.vueNodes.selectNode(String(NODE_ID))
        await page
          .getByTestId(TestIds.selectionToolbox.colorPickerButton)
          .dispatchEvent('click')
        await page
          .getByTestId(TestIds.selectionToolbox.colorRed)
          .dispatchEvent('click')
        await expect.poll(background).not.toBe(agentBackground)
        const userBackground = await background()

        agent.reportToolCall('set_node_field', 'call-rename')
        agent.applyAndBroadcast([renameNode(RENAMED_TITLE)])
        agent.finishTurn('Added a Load Image node named Reference Image.')
        await expect(agent.node(NODE_ID)).toContainText(RENAMED_TITLE)

        await expect(wrapper).toHaveCSS('background-color', userBackground)
      }
    )
  }
)
