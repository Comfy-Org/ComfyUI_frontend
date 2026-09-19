import { expect } from '@playwright/test'

import type { AgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

import {
  AgentConversationHarness,
  agentConversationTest
} from '@e2e/fixtures/agentConversationFixture'

// Agent template placement bug: `prepareNode` (graphMutations.ts) takes an `add_node` op's
// `pos` verbatim, with zero viewport-centering, bounding-box, or
// collision-avoidance logic. An agent's "load template" tool emits `add_node`
// ops carrying the template's own baked-in absolute layout coordinates
// (authored assuming an empty canvas), so template nodes land wherever the
// template file says, regardless of where the user's existing content
// already is. This conversation is hand-authored (not a capture), so it is
// marked `response_side: 'synthesized'` per agentConversation.ts's schema.
const CONVERSATION: AgentConversation = {
  schema_version: 'agent-conversation.v2',
  source: {
    repo: 'Comfy-Org/ComfyUI_frontend',
    suite: 'agent',
    case_id: 'synth-template-far-position',
    response_side: 'synthesized'
  },
  workflow: {
    id: '3f6a6b0e-2b1a-4a7a-8b0a-9d1a2e3c4f50',
    name: 'Template placement repro',
    catalog: {
      types: {
        LoadImage: { widget_order: ['image', 'upload'] },
        EmptyLatentImage: { widget_order: ['width', 'height', 'batch_size'] }
      }
    },
    seed: {
      // The user has already placed a Load Image node near the origin.
      nodes: [
        {
          id: 1,
          type: 'LoadImage',
          pos: [0, 0],
          size: [315, 314],
          inputs: [],
          outputs: [
            { name: 'IMAGE', type: 'IMAGE', links: [] },
            { name: 'MASK', type: 'MASK', links: [] }
          ],
          widgets_values: ['example.png', 'image']
        }
      ],
      links: []
    }
  },
  turns: [
    {
      request: { content: 'Load the sunburst template into this workflow.' },
      response: [
        {
          kind: 'event',
          event: {
            type: 'agent_message_delta',
            data: { delta: 'Loading the template nodes.' }
          }
        },
        {
          kind: 'graph_ops',
          // The template file's own baked-in absolute coordinates, authored
          // for an empty canvas — thousands of px from the existing node.
          ops: [
            {
              op: 'add_node',
              pos: [8000, 6000],
              node_id: 50,
              class_type: 'EmptyLatentImage',
              node: {
                id: 50,
                pos: [8000, 6000],
                mode: 0,
                size: [270, 106],
                type: 'EmptyLatentImage',
                flags: {},
                order: 1,
                inputs: [],
                outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
                properties: {},
                widgets_values: [512, 512, 1]
              }
            }
          ]
        },
        {
          kind: 'event',
          event: { type: 'agent_message_done', data: {} }
        }
      ]
    }
  ]
}

agentConversationTest.describe(
  'Agent template load ignores existing canvas content',
  { tag: ['@cloud', '@agent'] },
  () => {
    agentConversationTest(
      'places a newly loaded template node far from existing canvas content instead of near it',
      async ({ page, agentFlagEnabled }, testInfo) => {
        const harness = new AgentConversationHarness(
          page,
          CONVERSATION,
          'immediate',
          CONVERSATION.source.case_id
        )
        await harness.boot(agentFlagEnabled)
        await harness.sendPrompt(0)
        await harness.replayResponse(0)
        await harness.waitForTurnComplete()

        // Marked expected-to-fail up front: the position bug can also make
        // the template node fail to render into view at all (culled far
        // outside the viewport), so every assertion below — not only the
        // final distance check — is covered by this repro.
        agentConversationTest.fail(
          true,
          'prepareNode takes payload.pos verbatim (readPair, no offset/collision-avoidance logic), so the template node lands at its raw baked-in coordinates instead of near the existing Load Image node'
        )

        const existingLoadImage = harness.vueNodes.getNodeLocator('1')
        await expect(existingLoadImage).toBeVisible()

        // Graph-space distance, independent of canvas zoom/pan (and of
        // whether the far-away node is even culled into view): the same
        // numeric space `prepareNode`/`readPair` operate in.
        const [existingPos, templatePos] = await page.evaluate(() => {
          const nodes = window.app!.graph.nodes
          const byType = (type: string) =>
            nodes.find((node) => node.type === type)!.pos
          return [
            Array.from(byType('LoadImage')),
            Array.from(byType('EmptyLatentImage'))
          ] as const
        })
        const distance = Math.hypot(
          templatePos[0] - existingPos[0],
          templatePos[1] - existingPos[1]
        )

        await testInfo.attach('template-node-far-from-existing-content.png', {
          body: await page.screenshot(),
          contentType: 'image/png'
        })

        expect(distance).toBeLessThan(2000)
      }
    )
  }
)
