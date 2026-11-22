import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabChatTransitionsTest as test } from '@e2e/fixtures/agentTabChatTransitionsFixture'

/**
 * Opening a chat whose workflow is already open takes the switch path that
 * presents the retained graph instead of reloading it. An extension's
 * `beforeLoadGraph` hook runs inside that path, so anything the user does while
 * it awaits happens while the switch is still pending -- and starting a new
 * chat retires the restoration the opened chat asked for.
 *
 * @see https://github.com/Comfy-Org/ComfyUI_frontend/pull/24025
 * @see https://github.com/Comfy-Org/ComfyUI_frontend/issues/22480
 */
test.describe(
  'Superseded switch to an already-open workflow',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('a new chat started while a history chat is opening keeps the user on their own workflow', async ({
      page,
      tabChats
    }) => {
      await expect(
        tabChats.tab(0).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.panel.workflowPicker).toContainText(
        tabChats.workflows[0].name
      )

      await test.step('hold the next graph load inside beforeLoadGraph', async () =>
        page.evaluate(() => {
          let release!: () => void
          const held = new Promise<void>((resolve) => {
            release = resolve
          })
          const gate: NonNullable<typeof window.__heldGraphLoad> = {
            reached: false,
            release,
            abortedLoads: []
          }
          window.__heldGraphLoad = gate
          let holdNext = true
          window.app!.registerExtension({
            name: 'e2e.holdSwitchInsideBeforeLoadGraph',
            beforeLoadGraph: async () => {
              if (!holdNext) return
              holdNext = false
              gate.reached = true
              await held
            },
            onGraphLoadError: (error) => {
              gate.abortedLoads.push((error as Error).name)
            }
          })
        }))

      await tabChats.panel.openChatFromHistory(
        `${tabChats.workflows[1].name} chat`
      )
      await page.waitForFunction(() => window.__heldGraphLoad?.reached === true)

      await test.step('the user starts a new chat before the switch settles', async () => {
        await tabChats.panel.root
          .getByRole('button', { name: enMessages.agent.newChat })
          .click()
        await expect(tabChats.panel.composer).toHaveText('')
      })

      await page.evaluate(() => window.__heldGraphLoad!.release())

      await expect(tabChats.panel.userMessageBubbles).toHaveCount(0)
      await expect(
        tabChats.tab(0).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.panel.workflowPicker).toContainText(
        tabChats.workflows[0].name
      )
      await expect
        .poll(() => page.evaluate(() => window.__heldGraphLoad!.abortedLoads))
        .toEqual(['AbortError'])
    })
  }
)
