import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { COPY_PASTE_SCENARIO } from '@e2e/fixtures/data/agent/agentCopyPasteScenario'

test.describe(
  'Copy and paste beside the agent panel',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: COPY_PASTE_SCENARIO.conversation })
    test.setTimeout(120_000)

    test.beforeEach(async ({ agentConversation }) => {
      await agentConversation.replayTurn(0)
    })

    test('copying an agent-added node and pasting duplicates it', async ({
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(
        COPY_PASTE_SCENARIO.agentAddedType
      )

      await test.step('select the agent-added node', () =>
        agentConversation.selectNode(source.id))

      await test.step('copy', () => agentConversation.clipboard.copy())

      await test.step('paste', () => agentConversation.clipboard.paste())

      await test.step('one more node of that type is on the graph', async () => {
        await expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1)
        expect(await agentConversation.nodesAddedSince(before)).toEqual([
          expect.objectContaining({ type: COPY_PASTE_SCENARIO.agentAddedType })
        ])
      })
    })

    test('pastes a node clicked after transcript text was selected', async ({
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(
        COPY_PASTE_SCENARIO.agentAddedType
      )

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

    test.describe('text selected after the node click', () => {
      test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

      test('copies the transcript text instead of the node when text is selected after the node click', async ({
        agentConversation
      }) => {
        const before = await agentConversation.graphNodes()
        const source = await agentConversation.nodeOfType(
          COPY_PASTE_SCENARIO.agentAddedType
        )
        const reply = agentConversation.transcript.first()
        const replyText = (await reply.innerText()).trim()

        await test.step('select the agent-added node', () =>
          agentConversation.selectNode(source.id))

        await test.step('select transcript text', () => reply.selectText())

        await test.step('copy', () => agentConversation.clipboard.copy())

        await test.step('paste', () => agentConversation.clipboard.paste())

        await test.step('the text is on the clipboard and the graph is unchanged', async () => {
          await expect
            .poll(() => agentConversation.clipboard.readText())
            .toContain(replyText.split(/\s+/).slice(0, 3).join(' '))
          expect(await agentConversation.graphNodes()).toHaveLength(
            before.length
          )
        })
      })
    })

    test('pasting plain text into the composer leaves the canvas alone', async ({
      agentConversation
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(
        COPY_PASTE_SCENARIO.agentAddedType
      )
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

    test.describe('external text followed by intentional node paste', () => {
      test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

      for (const { mode, preparePanel } of [
        {
          mode: 'docked',
          preparePanel: async (panel: Locator) => expect(panel).toBeVisible()
        },
        {
          mode: 'maximized',
          preparePanel: async (panel: Locator) =>
            panel
              .getByRole('button', { name: enMessages.agent.maximize })
              .click()
        }
      ]) {
        test(`isolates external text in the ${mode} composer without breaking canvas paste`, async ({
          agentConversation,
          page
        }, testInfo) => {
          testInfo.annotations.push({
            type: 'issue',
            description: 'https://linear.app/comfyorg/issue/PM-1262'
          })
          const postedMessages: string[] = []
          page.on('request', (request) => {
            if (
              request.method() === 'POST' &&
              /\/api\/agent\/threads\/[^/]+\/messages$/.test(
                new URL(request.url()).pathname
              )
            )
              postedMessages.push(request.postData() ?? '')
          })
          const before = await agentConversation.graphNodes()
          const source = await agentConversation.nodeOfType(
            COPY_PASTE_SCENARIO.agentAddedType
          )
          await agentConversation.selectNode(source.id)
          await agentConversation.clipboard.copy()
          await preparePanel(agentConversation.panel)
          const graphBefore = await page.evaluate(() => {
            const { nodes, links } = window.app!.graph.serialize()
            return { nodes, links }
          })

          await agentConversation.clipboard.writeText(
            'Copper fox; keep seed 719 unchanged.'
          )
          await agentConversation.clipboard.paste(agentConversation.composer)
          await expect(agentConversation.composer).toHaveText(
            'Copper fox; keep seed 719 unchanged.'
          )
          await expect(
            agentConversation.composer.getByTestId('node-reference-chip')
          ).toHaveCount(0)
          await expect(
            agentConversation.panel.getByTestId('composer-node-section')
          ).toHaveCount(0)
          await expect
            .poll(() =>
              page.evaluate(() => {
                const { nodes, links } = window.app!.graph.serialize()
                return { nodes, links }
              })
            )
            .toEqual(graphBefore)
          expect(postedMessages).toEqual([])
          await page.screenshot({
            path: testInfo.outputPath('composer-external-text.png')
          })

          await agentConversation.panel
            .getByRole('button', { name: enMessages.agent.close, exact: true })
            .click()
          await expect(agentConversation.panel).toBeHidden()
          await agentConversation.selectNode(source.id)
          await agentConversation.clipboard.copy()
          await agentConversation.clipboard.paste()
          await expect
            .poll(() => agentConversation.graphNodes())
            .toHaveLength(before.length + 1)
          expect(await agentConversation.nodesAddedSince(before)).toEqual([
            expect.objectContaining({
              type: COPY_PASTE_SCENARIO.agentAddedType
            })
          ])
          expect(
            await page.evaluate(() => window.app!.graph.serialize().links)
          ).toEqual(graphBefore.links)
          expect(postedMessages).toEqual([])
          await page.screenshot({
            path: testInfo.outputPath('canvas-paste-after-composer.png')
          })
        })
      }
    })

    test('Ctrl+C in the composer with nothing selected leaves the node clipboard alone', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(
        COPY_PASTE_SCENARIO.agentAddedType
      )

      await test.step('select and copy the earlier node', async () => {
        await agentConversation.selectNode(COPY_PASTE_SCENARIO.earlierNode.id)
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
          expect.objectContaining({
            type: COPY_PASTE_SCENARIO.earlierNode.type
          })
        ])
      })
    })

    test('a canvas paste after copying transcript text adds nothing', async ({
      agentConversation,
      page
    }) => {
      const before = await agentConversation.graphNodes()
      const source = await agentConversation.nodeOfType(
        COPY_PASTE_SCENARIO.agentAddedType
      )
      const reply = agentConversation.transcript.first()

      await test.step('select and copy the earlier node', async () => {
        await agentConversation.selectNode(COPY_PASTE_SCENARIO.earlierNode.id)
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

      await test.step('the graph is unchanged', async () => {
        expect(await agentConversation.graphNodes()).toHaveLength(before.length)
      })

      await test.step('copying and pasting the agent-added node still adds exactly that node', async () => {
        await agentConversation.selectNode(source.id)
        await agentConversation.clipboard.copy()
        await agentConversation.clipboard.paste()
        await expect
          .poll(() => agentConversation.graphNodes())
          .toHaveLength(before.length + 1)
        expect(await agentConversation.nodesAddedSince(before)).toEqual([
          expect.objectContaining({ type: COPY_PASTE_SCENARIO.agentAddedType })
        ])
      })
    })
  }
)
