import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const QUESTION_CASE = 'agent-rec-text-only-answer'
const SEED_NODE_IDS = ['3', '4', '6', '8', '9'] as const

test.describe(
  'Agent question does not edit the canvas',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: QUESTION_CASE, humanOpsHost: 'apply' })

    test('answers an interrogative prompt without touching the graph', async ({
      page,
      agentConversation
    }) => {
      test.setTimeout(90_000)

      const readGraph = () =>
        page.evaluate(() => {
          const graph = window.app!.graph
          return {
            nodes: graph
              .serialize()
              .nodes.map((node) => ({
                id: String(node.id),
                type: node.type,
                mode: node.mode,
                widgets: JSON.stringify(node.widgets_values ?? null)
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
            links: [...graph.links.values()]
              .map(
                (link) =>
                  `${link.origin_id}:${link.origin_slot}->${link.target_id}:${link.target_slot}:${link.type}`
              )
              .sort()
          }
        })

      const recordedGraphOps = agentConversation.conversation.turns
        .flatMap((turn) => turn.response)
        .flatMap((entry) => (entry.kind === 'graph_ops' ? entry.ops : []))
        .map((op) => `${op.op}:${String(op.node_id)}`)

      await test.step('the capture this case replays carries no graph op of any kind', () => {
        expect(recordedGraphOps).toEqual([])
      })

      await expect(agentConversation.vueNodes.nodes).toHaveCount(
        SEED_NODE_IDS.length
      )
      const before = await readGraph()
      expect(before.nodes.map(({ id }) => id)).toEqual([...SEED_NODE_IDS])
      expect(before.links).not.toHaveLength(0)

      await agentConversation.runTurns()

      await test.step('the user got a text answer', async () => {
        await expect(
          agentConversation.panel.getByText('standard SDXL text-to-image setup')
        ).toBeVisible()
      })

      await test.step('the page minted no op of any kind', () => {
        expect(agentConversation.humanOps()).toEqual([])
      })

      await test.step('every node type, mode, widget value and link the user had is still there, and nothing else is', async () => {
        await expect.poll(readGraph).toEqual(before)
      })

      await test.step('the shared document holds exactly the seed nodes', () => {
        const hostNodeIds = agentConversation.hostNodeIds()
        expect(hostNodeIds).toEqual(expect.arrayContaining([...SEED_NODE_IDS]))
        expect(hostNodeIds).toHaveLength(SEED_NODE_IDS.length)
      })

      await test.step('the canvas still renders exactly the seed nodes', async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(
          SEED_NODE_IDS.length
        )
        for (const nodeId of SEED_NODE_IDS) {
          await expect(
            agentConversation.vueNodes.getNodeLocator(nodeId)
          ).toBeVisible()
        }
      })
    })
  }
)
