import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const SHOW_HISTORY_LABEL = enMessages.agent.showChatHistory
const CHAT_OPTIONS_LABEL = enMessages.agent.chatOptions
const RENAME_LABEL = enMessages.g.rename

// Precondition, not the criterion. The history list is populated by
// AgentPanelRoot.vue:808 -> history.replaceAll((await listThreads())...),
// and listThreads() GETs /agent/threads (agentRestClient.ts:149). Seeding
// through that route is the app's own load path, so the rows under test are
// rendered by the real component from real store state - nothing is injected
// into the DOM and no state is faked past the UI.
const SEEDED_THREAD_ID = 'thread-rename-focus'
const SEEDED_TITLE = 'Seeded session'

async function seedOneThread(page: Parameters<typeof bootAgentApp>[0]) {
  await page.route('**/agent/threads', (route) =>
    route.fulfill(
      jsonRoute({
        threads: [
          {
            id: SEEDED_THREAD_ID,
            title: SEEDED_TITLE,
            updated_at: new Date(0).toISOString()
          }
        ]
      })
    )
  )
}

test.describe('Agent chat history rename', { tag: '@cloud' }, () => {
  test('the rename editor survives the dropdown close focus restore', async ({
    page,
    agentFlagEnabled
  }) => {
    await seedOneThread(page)
    await bootAgentApp(page, agentFlagEnabled)

    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(page.getByTestId('agent-panel-root')).toBeVisible()

    await page.getByRole('button', { name: SHOW_HISTORY_LABEL }).click()

    // Positive anchor: the seeded row rendered, so a later absence means the
    // editor was torn down, not that history was empty all along.
    const row = page.getByText(SEEDED_TITLE)
    await expect(row).toBeVisible()

    await page.getByRole('button', { name: CHAT_OPTIONS_LABEL }).click()
    const renameItem = page.getByRole('menuitem', { name: RENAME_LABEL })
    await expect(renameItem).toBeVisible()
    await renameItem.click()

    // THE ORDERING THAT MAKES THIS TEST BITE.
    // reka-ui restores focus to the trigger as part of closing the menu. If we
    // asserted immediately after the click we would sample focus BEFORE that
    // restore and pass on a broken build. So: wait for the menu to actually be
    // gone - that is the close completing, which is when the restore runs - and
    // only then sample. No fixed timeout: the detachment IS the signal.
    await expect(renameItem).toHaveCount(0)

    const editor = page.getByRole('textbox', { name: RENAME_LABEL })

    // (1) still mounted. cancelRename() (ChatHistoryScreen.vue:155, @blur)
    // unmounts the editor, so a stolen focus shows up here first.
    await expect(editor).toBeVisible()

    // (2) focus is on the editor, not the trigger it was restored to.
    await expect(editor).toBeFocused()

    // (3) the editor is actually usable, not merely present: typing lands in
    // it and Enter commits. Guards a "fix" that keeps the input mounted but
    // leaves it inert.
    await editor.fill('Renamed by fence')
    await editor.press('Enter')
    await expect(page.getByText('Renamed by fence')).toBeVisible()
    await expect(editor).toHaveCount(0)
  })
})
