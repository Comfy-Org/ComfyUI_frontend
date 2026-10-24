import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const SEVERED_LINK_ID = 1
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
        await agentConversation.severLink()
        expect(await agentConversation.canvasLinkIds()).not.toContain(
          SEVERED_LINK_ID
        )
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
          .poll(() => agentConversation.canvasLinkIds())
          .toEqual(expect.arrayContaining(SURVIVING_LINK_IDS))
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
