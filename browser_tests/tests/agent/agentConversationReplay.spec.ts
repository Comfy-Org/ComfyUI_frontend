import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'

type Viewport = { scale: number; offset: [number, number] }

// Deliberately not the load-time default so a rebuild that resets the canvas
// transform is visible.
const TAB_A_VIEWPORT: Viewport = { scale: 1.25, offset: [40, 60] }

// A second, unrelated workflow opened beside the agent's tab: one string
// widget, one Markdown body, no links, and its own saved viewport. None of it
// is in the CRDT host, so anything the follower rebuilds from would lose it.
const TAB_B_NAME = 'Tab B'
const TAB_B_PROMPT_ID = 1
const TAB_B_NOTE_ID = 2
const TAB_B_PROMPT = 'tab b prompt'
const TAB_B = {
  last_node_id: 2,
  last_link_id: 0,
  nodes: [
    {
      id: TAB_B_PROMPT_ID,
      type: 'CLIPTextEncode',
      pos: [120, 80],
      size: [400, 200],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        { name: 'clip', type: 'CLIP', link: null },
        { name: 'text', type: 'STRING', widget: { name: 'text' }, link: null }
      ],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
      properties: {},
      widgets_values: [TAB_B_PROMPT]
    },
    {
      id: TAB_B_NOTE_ID,
      type: 'MarkdownNote',
      pos: [600, 300],
      size: [320, 180],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['## Tab B note\n\nkeep me']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: { ds: { scale: 0.8, offset: [-100, -40] } },
  version: 0.4
} satisfies ComfyWorkflowJSON & { extra: { ds: Viewport } }

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

    // PM-985: leaving and re-entering the agent's workflow tab rebuilt the
    // canvas from a snapshot that carried no display titles or positional
    // widget values. Two tabs alternate with the Agent open: the agent's own
    // workflow (seed graph plus the two turns' edits, a non-default viewport)
    // and an unrelated second workflow with its own nodes, Markdown body and
    // viewport. At every stop each tab must still read the way it did when it
    // was last shown, and exactly one Agent panel stays mounted throughout.
    test('preserves each workflow rendered graph while switching tabs with Agent open', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(120_000)
      const tabs = page.getByTestId('workflow-tab')
      const panel = agentConversation.panel
      const lastTurn = agentConversation.conversation.turns.length - 1
      const nodes = agentConversation.vueNodes

      const expectOnePanel = async () => {
        await expect(panel).toHaveCount(1)
        await expect(panel).toBeVisible()
      }
      const expectViewport = (viewport: Viewport) =>
        expect
          .poll(() =>
            page.evaluate(() => ({
              scale: window.app!.canvas.ds.scale,
              offset: [...window.app!.canvas.ds.offset] as [number, number]
            }))
          )
          .toEqual(viewport)
      const expectTabA = async () => {
        await agentConversation.expectCanvasReplayed(lastTurn)
        await expectViewport(TAB_A_VIEWPORT)
        await expectOnePanel()
      }
      const expectTabB = async () => {
        await expect(page.getByTestId('node-title')).toHaveCount(
          TAB_B.nodes.length
        )
        const prompt = nodes.getNodeLocator(String(TAB_B_PROMPT_ID))
        await expect(prompt).toBeVisible()
        await expect(prompt.getByLabel('text', { exact: true })).toHaveValue(
          TAB_B_PROMPT
        )
        const note = nodes.getNodeLocator(String(TAB_B_NOTE_ID))
        await expect(note).toBeVisible()
        const body = note.getByLabel('text', { exact: true })
        await expect(body).toContainText('Tab B note')
        await expect(body).toContainText('keep me')
        await expect
          .poll(() => page.evaluate(() => window.app!.graph.links.size))
          .toBe(0)
        await expectViewport(TAB_B.extra.ds)
        await expectOnePanel()
      }
      // Tab return makes the follower subscribe again; the host answers with
      // the catch-up frame that drove the regression, so wait for it to land
      // before judging the canvas, or a late rebuild could pass unseen.
      const returnToTabA = async () => {
        const before = agentConversation.subscribeCount()
        await tabs.first().click()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBe(before + 1)
      }

      await test.step('agent tab settles with a non-default viewport', async () => {
        await agentConversation.runTurns()
        await page.evaluate(({ scale, offset }) => {
          window.app!.canvas.ds.scale = scale
          window.app!.canvas.ds.offset = [...offset]
          window.app!.canvas.setDirty(true, true)
        }, TAB_A_VIEWPORT)
        await expect(tabs).toHaveCount(1)
        await expectTabA()
      })

      await test.step('second workflow opens in its own tab', async () => {
        await page.evaluate(
          ({ json, name }) => window.app!.loadGraphData(json, true, true, name),
          { json: TAB_B, name: TAB_B_NAME }
        )
        await expect(tabs).toHaveCount(2)
        await expect(
          page.locator('.workflow-tabs .p-togglebutton-checked')
        ).toContainText(TAB_B_NAME)
        await expectTabB()
      })

      await test.step('back to the agent tab', async () => {
        await returnToTabA()
        await expectTabA()
      })

      await test.step('second round trip', async () => {
        await tabs.nth(1).click()
        await expectTabB()
        await returnToTabA()
        await expectTabA()
      })
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
