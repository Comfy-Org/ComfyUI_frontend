import { expect } from '@playwright/test'

import {
  AGENT_COPY_PASTE_SCENARIO,
  agentCopyPasteTest as test
} from '@e2e/fixtures/AgentCopyPasteDriver'

test.describe(
  'Copy and paste beside the agent panel',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: AGENT_COPY_PASTE_SCENARIO.conversation,
      permissions: ['clipboard-read', 'clipboard-write']
    })
    test.setTimeout(120_000)

    test.beforeEach(async ({ agentCopyPaste }) => {
      await agentCopyPaste.replayTurn(0)
    })

    test('pastes a node clicked after transcript text was selected', async ({
      agentCopyPaste
    }) => {
      const before = await agentCopyPaste.graphNodes()
      const source = await agentCopyPaste.nodeOfType(
        AGENT_COPY_PASTE_SCENARIO.agentAddedStandInType
      )

      await test.step('select transcript text', () =>
        agentCopyPaste.transcript.first().selectText())

      await test.step('select the agent-added node', () =>
        agentCopyPaste.revealAndSelectNode(source.id))

      await test.step('copy and paste', async () => {
        await agentCopyPaste.clipboard.copy()
        await agentCopyPaste.clipboard.paste()
      })

      await test.step('one more node is on the graph', () =>
        expect
          .poll(() => agentCopyPaste.graphNodes())
          .toHaveLength(before.length + 1))
    })

    test('Ctrl+C in the empty composer preserves the node clipboard', async ({
      agentCopyPaste,
      page
    }) => {
      const before = await agentCopyPaste.graphNodes()
      const source = await agentCopyPaste.nodeOfType(
        AGENT_COPY_PASTE_SCENARIO.agentAddedStandInType
      )

      await test.step('copy the earlier node', async () => {
        await agentCopyPaste.revealAndSelectNode(
          AGENT_COPY_PASTE_SCENARIO.earlierNode.id
        )
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('copy in the empty composer', async () => {
        await agentCopyPaste.revealAndSelectNode(source.id)
        await agentCopyPaste.composer.click()
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('paste on the canvas', () =>
        agentCopyPaste.clipboard.paste(page.locator('#graph-canvas')))

      await test.step('the earlier node is pasted', async () => {
        await expect
          .poll(() => agentCopyPaste.graphNodes())
          .toHaveLength(before.length + 1)
        expect(await agentCopyPaste.nodesAddedSince(before)).toEqual([
          expect.objectContaining({
            type: AGENT_COPY_PASTE_SCENARIO.earlierNode.type
          })
        ])
      })
    })

    test('copying transcript text clears the keyboard node clipboard', async ({
      agentCopyPaste,
      page
    }) => {
      const before = await agentCopyPaste.graphNodes()
      const reply = agentCopyPaste.transcript.first()
      const replyText = (await reply.innerText()).trim()

      await test.step('copy the earlier node', async () => {
        await agentCopyPaste.revealAndSelectNode(
          AGENT_COPY_PASTE_SCENARIO.earlierNode.id
        )
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('copy transcript text', async () => {
        await reply.selectText()
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('paste on the canvas', async () => {
        await reply.click()
        await agentCopyPaste.clipboard.paste(page.locator('#graph-canvas'))
      })

      await test.step('the text is on the clipboard and the graph is unchanged', async () => {
        await expect
          .poll(() => agentCopyPaste.clipboard.readText())
          .toContain(replyText.split(/\s+/).slice(0, 3).join(' '))
        expect(await agentCopyPaste.graphNodes()).toHaveLength(before.length)
      })
    })

    test('text copy preserves a newer equal command copy', async ({
      agentCopyPaste,
      page
    }) => {
      const before = await agentCopyPaste.graphNodes()
      const source = await agentCopyPaste.nodeOfType(
        AGENT_COPY_PASTE_SCENARIO.agentAddedStandInType
      )
      const reply = agentCopyPaste.transcript.first()

      await test.step('copy the same node with the keyboard and command', async () => {
        await agentCopyPaste.revealAndSelectNode(source.id)
        await agentCopyPaste.clipboard.copy()
        await agentCopyPaste.command.executeCommand('Comfy.Canvas.CopySelected')
      })

      await test.step('copy transcript text', async () => {
        await reply.selectText()
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('paste on the canvas', async () => {
        await reply.click()
        await agentCopyPaste.clipboard.paste(page.locator('#graph-canvas'))
      })

      await test.step('the command-copied node is pasted', async () => {
        await expect
          .poll(() => agentCopyPaste.graphNodes())
          .toHaveLength(before.length + 1)
        expect(await agentCopyPaste.nodesAddedSince(before)).toEqual([
          expect.objectContaining({
            type: AGENT_COPY_PASTE_SCENARIO.agentAddedStandInType
          })
        ])
      })
    })
  }
)
