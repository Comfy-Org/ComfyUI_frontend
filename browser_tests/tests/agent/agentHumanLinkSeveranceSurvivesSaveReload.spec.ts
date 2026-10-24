import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A connection the user severed on the canvas must be gone from the document
// the agent reads, and must STAY gone across an explicit save and a page
// reload. The reload is the whole point: the user who reported this saved and
// refreshed, confirmed the link was still absent from the canvas, asked the
// agent again, and the agent still reported the connection as live — "my
// server-side copy is the stale one, not your canvas", in its own words.
//
// The two views this pins against each other:
//   - the canvas, read from `LGraph.links` (`canvasLinkIds`) — what the user
//     sees and what executes;
//   - the shared document, read from the library's own projection
//     (`hostLinkIds`) — what an agent turn is handed as its working copy.
//
// A spec that only asserted the canvas would pass while the bug was live, and a
// unit test on either side alone cannot see a divergence between them at all.
//
// The severance reaches the document as a `disconnect` op minted at the command
// site (`LGraph.removeLink` -> the `disconnect` intent -> `docOpMinter`), which
// is what KEEP-ALIVE #14 requires. It is deliberately NOT asserted by diffing
// the projection against the live graph: that is FORECLOSE #13, and its absence
// is the invariant.
const CASE = 'agent-rec-text-only-answer'
// [1, 4, 1, 6, 0, 'CLIP'] in the seed: node 4's CLIP output into node 6.
const SEVERED_LINK_ID = 1
// Node 4 fans out to three consumers, so severing one of them must leave the
// other two — the reporter noticed the bug precisely because a sibling link off
// the same node was still correct.
const SURVIVING_LINK_IDS = [2, 3, 4, 5, 6]
const SAVED_NAME = 'Severed link survives reload'

test.describe(
  'A human link severance survives save and reload in the agent-visible graph',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps the severed connection out of the document the agent reads after a save and reload', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(120_000)

      await agentConversation.persistSavedWorkflow()

      await test.step('bind the seeded workflow and record both views', async () => {
        await agentConversation.runTurns()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(0)
        expect(agentConversation.hostLinkIds()).toEqual(
          expect.arrayContaining([SEVERED_LINK_ID, ...SURVIVING_LINK_IDS])
        )
        expect(await agentConversation.canvasLinkIds()).toEqual(
          expect.arrayContaining([SEVERED_LINK_ID, ...SURVIVING_LINK_IDS])
        )
      })

      await test.step('the user severs one connection on the canvas', async () => {
        await agentConversation.severLink(SEVERED_LINK_ID)
        expect(await agentConversation.canvasLinkIds()).not.toContain(
          SEVERED_LINK_ID
        )
        // Minted at the command site, not reverse-engineered from a store side
        // effect (FORECLOSE #14). `opLabel` has no id slot for a link op, so
        // the op KIND is what is assertable here; the document assertion below
        // is what proves the right link went.
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
          .poll(() => agentConversation.hostLinkIds())
          .not.toContain(SEVERED_LINK_ID)
        expect(agentConversation.hostLinkIds()).toEqual(
          expect.arrayContaining(SURVIVING_LINK_IDS)
        )
      })

      await test.step('the user saves and refreshes the page', async () => {
        await agentConversation.topbar.saveWorkflowAs(SAVED_NAME)
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
        // The reporter's step 4: the connection is still absent from the
        // canvas after the refresh. If this fails the bug is a different one.
        expect(await agentConversation.canvasLinkIds()).not.toContain(
          SEVERED_LINK_ID
        )
      })

      await test.step('the agent still reads the connection as gone', async () => {
        const before = agentConversation.subscribeCount()
        await agentConversation.sendPrompt()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(before)
        expect(agentConversation.hostLinkIds()).not.toContain(SEVERED_LINK_ID)
        expect(agentConversation.hostLinkIds()).toEqual(
          expect.arrayContaining(SURVIVING_LINK_IDS)
        )
        expect(await agentConversation.canvasLinkIds()).not.toContain(
          SEVERED_LINK_ID
        )
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
