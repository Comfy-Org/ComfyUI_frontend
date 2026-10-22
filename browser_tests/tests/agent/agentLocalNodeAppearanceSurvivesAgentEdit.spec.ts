import { expect } from '@playwright/test'

import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addStyledLoadImageNode,
  setNodeTitle
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'
import { NodeAppearanceEditor } from '@e2e/fixtures/helpers/NodeAppearanceEditor'

const [NODE_ID] = AGENT_NODE_IDS
const RENAMED_TITLE = 'Reference Image'
const ISSUE = {
  type: 'issue',
  description:
    'https://linear.app/comfyorg/issue/FE-3494/crdt-sync-local-node-colourshapeproperties-edits-are-not-written-back'
}

test.describe(
  'A local node appearance edit survives an agent edit to the same node',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    let agent: AgentRemoteApplyHarness
    let appearance: NodeAppearanceEditor

    test.beforeEach(async ({ page }) => {
      agent = new AgentRemoteApplyHarness(page)
      appearance = new NodeAppearanceEditor(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add a load image node and name it')
      await agent.hostSocket.waitForSubscribe()
    })

    test(
      'recolouring a node mid-turn is not reverted when the agent renames it',
      { annotation: [ISSUE] },
      async () => {
        agent.reportToolCall('add_node', 'call-add')
        agent.applyAndBroadcast([
          addStyledLoadImageNode(NODE_ID, 0, {
            color: '#232',
            bgcolor: '#353'
          })
        ])
        await expect(agent.node(NODE_ID)).toBeVisible()
        const documentColour = await appearance.backgroundColor(NODE_ID)

        await appearance.recolourRed(NODE_ID)
        await expect
          .poll(() => appearance.backgroundColor(NODE_ID))
          .not.toBe(documentColour)
        const userColour = await appearance.backgroundColor(NODE_ID)

        agent.reportToolCall('set_node_field', 'call-rename')
        agent.applyAndBroadcast([setNodeTitle(NODE_ID, RENAMED_TITLE)])
        agent.finishTurn('Added a Load Image node named Reference Image.')
        await expect(agent.node(NODE_ID)).toContainText(RENAMED_TITLE)

        test.fail()
        await expect(appearance.wrapper(NODE_ID)).toHaveCSS(
          'background-color',
          userColour
        )
      }
    )

    test(
      'reshaping a node mid-turn is not reverted when the agent renames it',
      { annotation: [ISSUE] },
      async () => {
        agent.reportToolCall('add_node', 'call-add')
        agent.applyAndBroadcast([
          addStyledLoadImageNode(NODE_ID, 0, { shape: RenderShape.CARD })
        ])
        await expect(agent.node(NODE_ID)).toBeVisible()
        const documentRadius = await appearance.borderRadius(NODE_ID)

        await appearance.reshape(NODE_ID, 'Box')
        await expect
          .poll(() => appearance.borderRadius(NODE_ID))
          .not.toBe(documentRadius)
        const userRadius = await appearance.borderRadius(NODE_ID)

        agent.reportToolCall('set_node_field', 'call-rename')
        agent.applyAndBroadcast([setNodeTitle(NODE_ID, RENAMED_TITLE)])
        agent.finishTurn('Added a Load Image node named Reference Image.')
        await expect(agent.node(NODE_ID)).toContainText(RENAMED_TITLE)

        test.fail()
        await expect(appearance.wrapper(NODE_ID)).toHaveCSS(
          'border-top-left-radius',
          userRadius
        )
      }
    )
  }
)
