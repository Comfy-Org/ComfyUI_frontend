import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const SEVERED_LINK_ID = 1
const SURVIVING_LINK_IDS = [2, 3, 4, 5, 6]
const SAVED_NAME = 'Severed link survives reload'
// Every link in the seed terminates on a node input, so the ids the host
// document reports as connected are exactly the `link` fields its projected
// nodes carry. Reading them that way keeps this pin inside
// `browser_tests/tests/agent/**` instead of adding a method to the shared
// conversation fixture, which many other specs import.
const SEED_NODE_IDS = ['3', '4', '6', '8', '9']

function inputLinkIds(node: { inputs?: unknown } | undefined): number[] {
  const inputs = Array.isArray(node?.inputs) ? node.inputs : []
  return inputs.flatMap((input) => {
    if (typeof input !== 'object' || input === null) return []
    const { link } = input as { link?: unknown }
    return typeof link === 'number' ? [link] : []
  })
}

/**
 * The link ids the shared document holds — what an agent turn is handed as its
 * working copy, read from the library's own projection rather than from the
 * canvas. A spec that only asserted the canvas would pass while the bug was
 * live, and a unit test on either side alone cannot see a divergence between
 * them at all.
 */
function hostLinkIds(conversation: AgentConversationHarness): number[] {
  return SEED_NODE_IDS.flatMap((id) =>
    inputLinkIds(conversation.hostNode(id))
  ).sort((a, b) => a - b)
}

/** The link ids the canvas holds — what the user sees and what executes. */
function canvasLinkIds(page: Page): Promise<number[]> {
  return page.evaluate(() => [...window.app!.graph.links.keys()].map(Number))
}

test.describe(
  'A human link severance survives save and reload in the agent-visible graph',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps the severed connection out of the document the agent reads after a save and reload', async ({
      agentConversation,
      comfyPage,
      page
    }, testInfo) => {
      test.setTimeout(120_000)

      await agentConversation.persistSavedWorkflow()

      await test.step('bind the seeded workflow and record both views', async () => {
        await agentConversation.runTurns()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(0)
        expect(hostLinkIds(agentConversation)).toEqual(
          expect.arrayContaining([SEVERED_LINK_ID, ...SURVIVING_LINK_IDS])
        )
        expect(await canvasLinkIds(page)).toEqual(
          expect.arrayContaining([SEVERED_LINK_ID, ...SURVIVING_LINK_IDS])
        )
      })

      await test.step('the user severs one connection on the canvas', async () => {
        // Dropping a dragged link on empty canvas runs
        // `Comfy.LinkRelease.Action`, and under the default the release only
        // lands once the menu it opens is dismissed — `NodeSearchBoxPopover`
        // cancels litegraph's reset and calls `disconnectLinks()` from the
        // menu's abort handler. This pin is about the severance surviving a
        // save and a reload, not about which release action is configured, so
        // it takes the same `no action` route `linkNodeInteractionSettings`
        // and `interaction` already use for an unambiguous disconnect gesture.
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.Action',
          'no action'
        )
        const targetNode = await comfyPage.nodeOps.getNodeRefById(6)
        const targetInput = await targetNode.getInput(0)
        const emptyCanvasPosition = await page.evaluate(() => {
          const app = window.app!
          const canvas = app.canvas.canvas
          const bounds = canvas.getBoundingClientRect()

          for (let y = bounds.bottom - 40; y >= bounds.top + 40; y -= 40) {
            for (let x = bounds.left + 40; x <= bounds.right - 40; x += 40) {
              if (document.elementFromPoint(x, y) !== canvas) continue

              const [canvasX, canvasY] = app.clientPosToCanvasPos([x, y])
              if (!app.graph.getNodeOnPos(canvasX, canvasY, app.graph.nodes)) {
                return { x, y }
              }
            }
          }

          throw new Error('No visible empty canvas position found')
        })
        await comfyPage.canvasOps.dragAndDrop(
          await targetInput.getPosition(),
          emptyCanvasPosition
        )
        await targetInput.expectLinkCount(0)
        expect(await canvasLinkIds(page)).not.toContain(SEVERED_LINK_ID)
        // Minted at the command site, not reverse-engineered from a store side
        // effect. `opLabel` has no id slot for a link op, so the op KIND is
        // what is assertable here; the document assertion below is what proves
        // the right link went.
        await expect
          .poll(() =>
            agentConversation.humanOpFrames().flatMap((frame) => frame.ops)
          )
          .toEqual(
            expect.arrayContaining([expect.stringMatching(/^disconnect/)])
          )
      })

      await test.step('the severance reaches the agent-visible document', async () => {
        await expect
          .poll(() => hostLinkIds(agentConversation))
          .not.toContain(SEVERED_LINK_ID)
        expect(hostLinkIds(agentConversation)).toEqual(
          expect.arrayContaining(SURVIVING_LINK_IDS)
        )
      })

      await test.step('the user saves and refreshes the page', async () => {
        await agentConversation.topbar.saveWorkflowAs(SAVED_NAME)
        const savedLinks = (
          (await agentConversation.savedWorkflowContent()).links ?? []
        ).map((link) => (Array.isArray(link) ? link[0] : link.id))
        expect(savedLinks).not.toContain(SEVERED_LINK_ID)
        expect(savedLinks).toEqual(expect.arrayContaining(SURVIVING_LINK_IDS))
        const restored = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            decodeURIComponent(new URL(response.url()).pathname) ===
              `/api/userdata/workflows/${SAVED_NAME}.json`,
          { timeout: 60_000 }
        )
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })
        const picker = agentConversation.panel.getByRole('button', {
          name: enMessages.agent.switchWorkflow
        })
        await picker.click()
        await page
          .getByRole('menuitemradio', { name: SAVED_NAME, exact: true })
          .click()
        await expect(picker).toHaveText(SAVED_NAME)
        expect((await restored).ok()).toBe(true)
        await expect
          .poll(() => canvasLinkIds(page))
          .toEqual(expect.arrayContaining(SURVIVING_LINK_IDS))
        expect(await canvasLinkIds(page)).not.toContain(SEVERED_LINK_ID)
      })

      await test.step('the agent still reads the connection as gone', async () => {
        const before = agentConversation.subscribeCount()
        await agentConversation.sendPrompt()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(before)
        expect(hostLinkIds(agentConversation)).not.toContain(SEVERED_LINK_ID)
        expect(hostLinkIds(agentConversation)).toEqual(
          expect.arrayContaining(SURVIVING_LINK_IDS)
        )
        expect(await canvasLinkIds(page)).not.toContain(SEVERED_LINK_ID)
      })

      const after = testInfo.outputPath('after-reload.png')
      await page.screenshot({ path: after })
      await testInfo.attach('after-reload', {
        path: after,
        contentType: 'image/png'
      })
    })
  }
)
