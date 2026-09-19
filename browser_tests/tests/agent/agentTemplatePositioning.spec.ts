import { expect } from '@playwright/test'

import type { AgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

import {
  AgentConversationHarness,
  agentConversationTest
} from '@e2e/fixtures/agentConversationFixture'

// Regression test for the agent template placement bug: `prepareNode`
// (graphMutations.ts) used to take an `add_node` op's `pos` verbatim, with
// zero viewport-centering, bounding-box, or collision-avoidance logic, so an
// agent's "load template" tool emitting the template's own baked-in absolute
// layout coordinates (authored assuming an empty canvas) landed the new node
// wherever the template file said, regardless of where the user's existing
// content already was. This conversation is hand-authored (not a capture),
// so it is marked `response_side: 'synthesized'` per agentConversation.ts's
// schema.
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
  'Agent template load respects existing canvas content',
  { tag: ['@cloud', '@agent'] },
  () => {
    agentConversationTest(
      'places a newly loaded template node near existing canvas content instead of far from it',
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

        await testInfo.attach(
          'template-node-placed-near-existing-content.png',
          {
            body: await page.screenshot(),
            contentType: 'image/png'
          }
        )

        const diag = await page.evaluate(
          () => (window as unknown as { __agentDiag?: unknown[] }).__agentDiag
        )
        expect(
          distance,
          `distance=${distance} diag=${JSON.stringify(diag)}`
        ).toBeLessThan(2000)
      }
    )
  }
)
