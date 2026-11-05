import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { AgentCopyPasteDriver } from '@e2e/fixtures/AgentCopyPasteDriver'
import {
  AGENT_COPY_PASTE_SCENARIO,
  agentCopyPasteTest as test
} from '@e2e/fixtures/AgentCopyPasteDriver'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { nextFrame } from '@e2e/fixtures/utils/timing'

const COMPOSER_PASTE_TEXT = 'make the sampler deterministic'

type LiveGraphNodes = Awaited<ReturnType<AgentCopyPasteDriver['graphNodes']>>

const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'

const SETTLE_FRAMES = 10

function nodeClipboardTypes(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { nodes?: { type?: string }[] }
    return (parsed.nodes ?? []).map((node) => node.type ?? '')
  }, CANVAS_CLIPBOARD_KEY)
}

function byId(nodes: LiveGraphNodes): LiveGraphNodes {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id))
}

async function expectGraphUnchanged(
  page: Page,
  agentCopyPaste: AgentCopyPasteDriver,
  before: LiveGraphNodes
): Promise<void> {
  const expected = byId(before)
  for (let sample = 0; sample < SETTLE_FRAMES; sample++) {
    await nextFrame(page)
    expect(byId(await agentCopyPaste.graphNodes())).toEqual(expected)
  }
}

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
        await new AgentPanel(page).clickBelowFirstPromptLine()
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

    test('pasting text into the composer leaves the graph untouched', async ({
      agentCopyPaste,
      page
    }) => {
      const before = await agentCopyPaste.graphNodes()

      await test.step('copy a node on the canvas', async () => {
        await agentCopyPaste.revealAndSelectNode(
          AGENT_COPY_PASTE_SCENARIO.earlierNode.id
        )
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('the node clipboard holds that node', async () => {
        expect(await nodeClipboardTypes(page)).toEqual([
          AGENT_COPY_PASTE_SCENARIO.earlierNode.type
        ])
      })

      await test.step('put plain text on the clipboard', () =>
        agentCopyPaste.clipboard.writeText(COMPOSER_PASTE_TEXT))

      await test.step('paste it into the composer', () =>
        agentCopyPaste.clipboard.paste(agentCopyPaste.composer))

      await test.step('the text lands in the composer', () =>
        expect(agentCopyPaste.composer).toContainText(COMPOSER_PASTE_TEXT))

      await test.step('the graph is untouched', () =>
        expectGraphUnchanged(page, agentCopyPaste, before))
    })

    test('a composer paste keeps the node clipboard usable on the canvas', async ({
      agentCopyPaste,
      page
    }) => {
      const before = await agentCopyPaste.graphNodes()

      await test.step('copy a node on the canvas', async () => {
        await agentCopyPaste.revealAndSelectNode(
          AGENT_COPY_PASTE_SCENARIO.earlierNode.id
        )
        await agentCopyPaste.clipboard.copy()
      })

      await test.step('the node clipboard holds that node', async () => {
        expect(await nodeClipboardTypes(page)).toEqual([
          AGENT_COPY_PASTE_SCENARIO.earlierNode.type
        ])
      })

      await test.step('paste plain text into the composer', async () => {
        await agentCopyPaste.clipboard.writeText(COMPOSER_PASTE_TEXT)
        await agentCopyPaste.clipboard.paste(agentCopyPaste.composer)
        await expect(agentCopyPaste.composer).toContainText(COMPOSER_PASTE_TEXT)
      })

      const afterComposerPaste =
        await test.step('the composer paste left the graph alone', async () => {
          await expectGraphUnchanged(page, agentCopyPaste, before)
          return agentCopyPaste.graphNodes()
        })

      await test.step('paste on the canvas', () =>
        agentCopyPaste.clipboard.paste(page.locator('#graph-canvas')))

      await test.step('the copied node is pasted', async () => {
        await expect
          .poll(() => agentCopyPaste.graphNodes())
          .toHaveLength(afterComposerPaste.length + 1)
        expect(
          await agentCopyPaste.nodesAddedSince(afterComposerPaste)
        ).toEqual([
          expect.objectContaining({
            type: AGENT_COPY_PASTE_SCENARIO.earlierNode.type
          })
        ])
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
