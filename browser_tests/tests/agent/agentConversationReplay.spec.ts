import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  test.describe('wire evidence', () => {
    test.use({ conversationCase: WIRING_CASE })

    // The second turn's only edit is a connect, so what the canvas shows after
    // it is the wire itself: the app's own render loop paints it, and the
    // expectation is the picture, not a reconstruction of the renderer.
    test('paints the wire the second turn connects @screenshot', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      await expect(page.locator('#graph-canvas')).toHaveScreenshot(
        'two-turn-dependent-edit-wired.png',
        { mask: [agentConversation.panel] }
      )
    })
  })

  for (const conversationCase of listRecordedConversations()) {
    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test('replays every recorded turn onto the panel and the canvas', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        await expect(
          agentConversation.panel.getByRole('button', {
            name: `Open ${agentConversation.conversation.workflow.name}`
          })
        ).toBeVisible()
      })
    })
  }
})

const minimaxTest = test.extend({
  page: async ({ page }, use) => {
    const unroute = await routeObjectInfoFromSetupApi(page, (objectInfo) => {
      objectInfo[BYTEDANCE_REFERENCE_NODE_TYPE] = byteDanceReferenceNodeDef
    })
    try {
      await use(page)
    } finally {
      await unroute()
    }
  }
})

minimaxTest.describe(
  'MiniMax-style autogrow reload',
  { tag: ['@agent', '@cloud'] },
  () => {
    minimaxTest.use({ conversationCase: WIRING_CASE })

    minimaxTest(
      'keeps widget links after a reference input grows',
      async ({ agentConversation, page }) => {
        await agentConversation.runTurns()
        await agentConversation.applyGraphOps([
          {
            op: 'add_node',
            node_id: 100,
            class_type: 'LoadImage',
            pos: [0, 500],
            node: {
              id: 100,
              type: 'LoadImage',
              pos: [0, 500],
              size: [250, 300],
              inputs: [],
              outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
              widgets_values: ['example.png', 'image']
            }
          },
          {
            op: 'add_node',
            node_id: 101,
            class_type: BYTEDANCE_REFERENCE_NODE_TYPE,
            pos: [400, 500],
            node: {
              id: 101,
              type: BYTEDANCE_REFERENCE_NODE_TYPE,
              pos: [400, 500],
              size: [350, 400],
              inputs: [
                {
                  name: 'model.reference_images.image_1',
                  type: 'IMAGE',
                  link: null
                },
                {
                  name: 'seed',
                  type: 'INT',
                  widget: { name: 'seed' },
                  link: null
                },
                {
                  name: 'watermark',
                  type: 'BOOLEAN',
                  widget: { name: 'watermark' },
                  link: null
                }
              ],
              outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }],
              widgets_values: [
                'Seedance 2.5',
                '',
                '720p',
                '16:9',
                5,
                true,
                false,
                'mp4',
                0,
                false
              ]
            }
          }
        ])

        const result = await page.evaluate(() => {
          const graph = window.app!.graph
          const source = graph._nodes.find(({ id }) => String(id) === '100')!
          const target = graph._nodes.find(({ id }) => String(id) === '101')!
          source.connect(
            0,
            target,
            target.findInputSlot('model.reference_images.image_1')
          )
          const seedName = 'seed'
          const seedLinkBefore =
            target.inputs[target.findInputSlot(seedName)].link
          const saved = structuredClone(graph.serialize())
          graph.configure(saved)
          const reopened = graph._nodes.find(({ id }) => String(id) === '101')!
          return {
            hasNextReference:
              reopened.findInputSlot('model.reference_images.image_2') >= 0,
            referenceLinked:
              reopened.inputs[
                reopened.findInputSlot('model.reference_images.image_1')
              ].link != null,
            seedLinkBefore,
            seedLinkAfter:
              reopened.inputs[reopened.findInputSlot(seedName)].link
          }
        })

        expect(result).toEqual({
          hasNextReference: true,
          referenceLinked: true,
          seedLinkBefore: null,
          seedLinkAfter: null
        })
      }
    )
  }
)
