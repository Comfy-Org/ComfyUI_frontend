import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Selection collapse and clipboard gating never depend on the node type, and
// the recording holds core types only, so EmptyLatentImage stands in for the
// reported Seedance node and the seed's SaveImage for SaveVideo.
const CASE = 'agent-rec-three-sequential-adds'
const AGENT_NODE_TYPE = 'EmptyLatentImage'
const EARLIER_COPY_ID = '9'
const EARLIER_COPY_TYPE = 'SaveImage'

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
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

      await test.step('select the agent-added node', () =>
        agentConversation.selectNode(source.id))

      await test.step('copy', () => agentConversation.clipboard.copy())

      await test.step('paste', () => agentConversation.clipboard.paste())

      await test.step('one more node of that type is on the graph', async () => {
        await expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1)
        expect(await agentConversation.nodesAddedSince(before)).toEqual([
          expect.objectContaining({ type: AGENT_NODE_TYPE })
        ])
      })
    })

    test('pastes a node clicked after transcript text was selected', async ({
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

      await test.step('select transcript text', () =>
        agentConversation.transcript.first().selectText())

      await test.step('select the agent-added node', () =>
        agentConversation.selectNode(source.id))

      await test.step('copy', () => agentConversation.clipboard.copy())

      await test.step('paste', () => agentConversation.clipboard.paste())

      await test.step('one more node is on the graph', () =>
        expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1))
    })

    test('copies and pastes the selected node when transcript text is selected after the node click', async ({
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

      await test.step('select the agent-added node', () =>
        agentConversation.selectNode(source.id))

      await test.step('select transcript text', () =>
        agentConversation.transcript.first().selectText())

      await test.step('copy', () => agentConversation.clipboard.copy())

      await test.step('paste', () => agentConversation.clipboard.paste())

      // Known defect: shouldIgnoreCopyPaste() swallows both keystrokes while
      // the transcript selection stands (plan comment, item 3).
      test.fail()

      await test.step('one more node is on the graph', () =>
        expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1))
    })

    test('pasting plain text into the composer leaves the canvas alone', async ({
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)
      const reply = agentConversation.transcript.first()
      const replyText = (await reply.innerText()).trim()

      await test.step('select and copy the agent-added node', async () => {
        await agentConversation.selectNode(source.id)
        await agentConversation.clipboard.copy()
      })

      await test.step('select and copy transcript text', async () => {
        await reply.selectText()
        await agentConversation.clipboard.copy()
      })

      await test.step('paste into the composer', async () => {
        await agentConversation.composer.click()
        await agentConversation.clipboard.paste()
      })

      await test.step('the text lands in the composer and the graph is unchanged', async () => {
        await expect(agentConversation.composer).toContainText(
          replyText.split(/\s+/).slice(0, 3).join(' ')
        )
        expect(await agentConversation.graphNodes()).toHaveLength(before.length)
      })
    })

    test('Ctrl+C in the composer with nothing selected leaves the node clipboard alone', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)

      await test.step('select and copy the earlier node', async () => {
        await agentConversation.selectNode(EARLIER_COPY_ID)
        await agentConversation.clipboard.copy()
      })

      await test.step('select the agent-added node', () =>
        agentConversation.selectNode(source.id))

      await test.step('Ctrl+C in the empty composer', async () => {
        await agentConversation.composer.click()
        await agentConversation.clipboard.copy()
      })

      await test.step('paste on the canvas', () =>
        agentConversation.clipboard.paste(page.locator('#graph-canvas')))

      await test.step('the earlier node is the one pasted', async () => {
        await expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1)
        expect(await agentConversation.nodesAddedSince(before)).toEqual([
          expect.objectContaining({ type: EARLIER_COPY_TYPE })
        ])
      })
    })

    test('a copy made while transcript text is selected does not make the next paste replay the previously copied node', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(AGENT_NODE_TYPE)
      const reply = agentConversation.transcript.first()

      await test.step('select and copy the earlier node', async () => {
        await agentConversation.selectNode(EARLIER_COPY_ID)
        await agentConversation.clipboard.copy()
      })

      await test.step('select the agent-added node', () =>
        agentConversation.selectNode(source.id))

      await test.step('copy while transcript text is selected', async () => {
        await reply.selectText()
        await agentConversation.clipboard.copy()
      })

      await test.step('click the transcript, then paste on the canvas', async () => {
        await reply.click()
        await agentConversation.clipboard.paste(page.locator('#graph-canvas'))
      })

      await test.step('one more node is on the graph', () =>
        expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1))

      // Known defect: usePaste falls back to the stale localStorage node
      // clipboard, which still holds the earlier node (plan comment, item 2).
      test.fail()

      await test.step('it is the node copied last', async () => {
        expect(await agentConversation.nodesAddedSince(before)).toEqual([
          expect.objectContaining({ type: AGENT_NODE_TYPE })
        ])
      })
    })
  }
)
