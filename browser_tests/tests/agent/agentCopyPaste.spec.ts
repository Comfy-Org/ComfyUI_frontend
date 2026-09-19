import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  saveImageAddNodeOp,
  setWidgetOp
} from '@e2e/fixtures/data/agent/copyPasteOps'

// Copy and paste next to the open agent panel, where a text selection in the
// transcript or focus in the composer used to swallow or misroute the graph
// clipboard. The recording adds three unwired core nodes to the seed graph;
// the reported types (a Seedance API node, SaveVideo) are not in its catalog,
// and none of the paths under test read the type, so the agent's
// EmptyLatentImage stands in for the node the user copies and the seed's
// SaveImage for a node that was copied earlier. The last case still pins an
// open mechanism with `test.fail`.
const CASE = 'agent-rec-three-sequential-adds'
const AGENT_NODE_TYPE = 'EmptyLatentImage'
const EARLIER_COPY_ID = '9'
const EARLIER_COPY_TYPE = 'SaveImage'
const KSAMPLER_ID = 3
const KSAMPLER_STEPS = { from: 20, to: 25 }
const COLLIDING_NODE_POS: [number, number] = [2900, 400]

test.describe(
  'Copy and paste beside the agent panel',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: CASE })
    test.setTimeout(120_000)

    test.beforeEach(async ({ agentConversation }) => {
      await agentConversation.replayTurn(0)
    })

    test('copying an agent-added node and pasting duplicates it', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

      await agentConversation.selectNode(source.id)
      await page.keyboard.press('Control+c')
      await page.keyboard.press('Control+v')

      await expect
        .poll(() => agentConversation.graphNodes())
        .toHaveLength(before.length + 1)
      expect(await agentConversation.nodesAddedSince(before)).toEqual([
        expect.objectContaining({ type: AGENT_NODE_TYPE })
      ])
    })

    for (const order of ['node first', 'text first'] as const) {
      test(`pastes a node copied while transcript text is selected (${order})`, async ({
        agentConversation,
        page
      }) => {
        const before = await agentConversation.graphNodes()
        const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)
        const reply = agentConversation.transcript.first()

        if (order === 'node first') {
          await agentConversation.selectNode(source.id)
          await reply.selectText()
        } else {
          await reply.selectText()
          await agentConversation.selectNode(source.id)
        }
        await page.keyboard.press('Control+c')
        await page.keyboard.press('Control+v')

        await expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1)
      })
    }

    test('pasting plain text into the composer leaves the canvas alone', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)
      const reply = agentConversation.transcript.first()
      const replyText = (await reply.innerText()).trim()

      await agentConversation.selectNode(source.id)
      await page.keyboard.press('Control+c')
      await reply.selectText()
      await page.keyboard.press('Control+c')
      await agentConversation.composer.click()
      await page.keyboard.press('Control+v')

      await expect(agentConversation.composer).toContainText(
        replyText.split(/\s+/).slice(0, 3).join(' ')
      )
      expect(await agentConversation.graphNodes()).toHaveLength(before.length)
    })

    test('Ctrl+C in the composer with nothing selected leaves the node clipboard alone', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

      await agentConversation.selectNode(EARLIER_COPY_ID)
      await page.keyboard.press('Control+c')
      await agentConversation.selectNode(source.id)
      await agentConversation.composer.click()
      await page.keyboard.press('Control+c')
      await page.locator('#graph-canvas').focus()
      await page.keyboard.press('Control+v')

      await expect
        .poll(() => agentConversation.graphNodes())
        .toHaveLength(before.length + 1)
      expect(await agentConversation.nodesAddedSince(before)).toEqual([
        expect.objectContaining({ type: EARLIER_COPY_TYPE })
      ])
    })

    test('a copy made while transcript text is selected is what the next paste yields', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)
      const reply = agentConversation.transcript.first()

      await agentConversation.selectNode(EARLIER_COPY_ID)
      await page.keyboard.press('Control+c')
      await agentConversation.selectNode(source.id)
      await reply.selectText()
      await page.keyboard.press('Control+c')
      await reply.click()
      await page.locator('#graph-canvas').focus()
      await page.keyboard.press('Control+v')

      await expect
        .poll(() => agentConversation.graphNodes())
        .toHaveLength(before.length + 1)
      expect(await agentConversation.nodesAddedSince(before)).toEqual([
        expect.objectContaining({ type: AGENT_NODE_TYPE })
      ])
    })

    // The pasted node's id never reached the document (the harness drops the
    // human add_node). An agent add_node for that id is rejected by the
    // follower's batch, which arms a full re-read on the next frame; that
    // re-read sees a type mismatch and replaces the live node
    // (graphMutations replaceNode, then agentNodeMaterializer.reconcile).
    test.fail(
      'an agent add_node that reuses a pasted node id must not swap the pasted node type',
      async ({ agentConversation, page }) => {
        const before = await agentConversation.graphNodes()
        const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

        await agentConversation.selectNode(source.id)
        await page.keyboard.press('Control+c')
        await page.keyboard.press('Control+v')
        await expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1)
        const [pasted] = await agentConversation.nodesAddedSince(before)

        await agentConversation.applyGraphOps([
          saveImageAddNodeOp(Number(pasted.id), COLLIDING_NODE_POS)
        ])
        await agentConversation.applyGraphOps([
          setWidgetOp(
            KSAMPLER_ID,
            'steps',
            KSAMPLER_STEPS.from,
            KSAMPLER_STEPS.to
          )
        ])
        const steps = agentConversation.vueNodes
          .getNodeLocator(String(KSAMPLER_ID))
          .getByLabel('steps', { exact: true })
          .locator('input')
          .first()
        await expect
          .poll(async () => Number(await steps.inputValue()))
          .toBe(KSAMPLER_STEPS.to)

        expect(await agentConversation.graphNodes()).toContainEqual({
          id: pasted.id,
          type: AGENT_NODE_TYPE
        })
      }
    )
  }
)
