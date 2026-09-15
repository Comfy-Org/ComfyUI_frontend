import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'

// PM-679: the transcript must survive a browser refresh with its content and
// order intact. `promptHistory` mocks `/api/agent/threads*` statefully (POST
// appends rows an in-memory array, GET replays it), so a `page.reload()` here
// exercises the real client path: `useAgentSession.start()` reads the
// persisted `Comfy.Agent.ThreadId` from localStorage and calls
// `hydrateFromServer`, which re-fetches this same history and replays it
// through `agentConversationStore.hydrate()`.
test.use({ connectWebSocketToServer: false })

test(
  'keeps the transcript and its order after a browser refresh',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    test.setTimeout(120_000)
    await expect(
      page.getByTestId('integrated-tab-bar-actions')
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 8_000 })
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(panel).toBeVisible()
    // The panel does not auto-bind the tab open when it mounts; the composer
    // gates Send behind an explicit target (agent.selectWorkflowForAgent).
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)
    const editor = panel.getByRole('textbox')

    const firstMessage = 'What does this workflow do?'
    await editor.fill(firstMessage)
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      firstMessage
    ])
    // Settle the first turn (no WS connection means no agent_message_done
    // will ever arrive) so Send reappears for the second message.
    await panel
      .getByRole('button', { name: enMessages.agent.stop, exact: true })
      .click()
    await expect(
      panel.getByRole('button', { name: enMessages.agent.send, exact: true })
    ).toBeVisible()

    const secondMessage = 'Now add a KSampler node.'
    await editor.fill(secondMessage)
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(2)
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      firstMessage,
      secondMessage
    ])

    const beforeReload = await panel
      .getByTestId('user-message-bubble')
      .allTextContents()

    await page.reload()
    await expect(
      page.getByTestId('integrated-tab-bar-actions')
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 30_000 })
    const reopenedPanel = page.locator('#agent-panel-root')
    await expect(reopenedPanel).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('button', { name: enMessages.agent.askComfyAgent })
    ).toHaveCount(0)

    // Same order and content, not merely the same count: a hydration bug
    // that re-sorts or drops a row would still pass a bare toHaveCount check.
    await expect(reopenedPanel.getByTestId('user-message-bubble')).toHaveText(
      beforeReload,
      { timeout: 30_000 }
    )
    await expect(
      reopenedPanel.getByTestId('user-message-bubble').nth(0)
    ).toHaveText(firstMessage)
    await expect(
      reopenedPanel.getByTestId('user-message-bubble').nth(1)
    ).toHaveText(secondMessage)
  }
)
