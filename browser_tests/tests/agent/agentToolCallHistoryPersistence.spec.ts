import { expect } from '@playwright/test'

import type { AgentMessage } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// FE-1305: a completed turn's tool calls (the work-summary trace shown live,
// via ToolPart in agent_tool_call WebSocket events) used to vanish on
// reload/chat-switch because getMessages's response was never read back into
// that same trace. The real backend now serializes each assistant row's
// `content.tool_calls` ([]persist.ToolCallSummary) verbatim.
// normalizeAgentTranscript (agentTranscript.ts) reads that field and folds it
// into the same ToolPart parts the live agent_tool_call handler builds, so
// agentConversationStore.hydrate() restores the identical WorkSummary UI.
// This test mimics that verbatim content pass-through (the shared fixture's
// own GET mock does not carry tool_calls) and asserts the summary survives a
// refresh.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'keeps a completed turn work summary after reload and chat switching',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    await page
      .getByRole('button', {
        name: enMessages.agent.askComfyAgent,
        exact: true
      })
      .click()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    // The composer gates Send behind an explicit workflow target
    // (agent.selectWorkflowForAgent); without this the click below never
    // reaches promptHistory.
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.pressSequentially('find a node for me')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    // The real ingest API returns the message row's `content` map verbatim,
    // including `tool_calls` once a turn's calls resolve server-side
    // (services/agent/server/agent_handler.go's getMessages sets
    // messageResponse.Content = m.Content directly). Stand in for that GET
    // response here.
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const request = promptHistory.requests.at(0)
      if (!request) return route.fallback()
      const threadId = new URL(route.request().url()).pathname
        .split('/')
        .at(-2)!
      const turnId = 'e2e-tool-call-turn'
      const messages: AgentMessage[] = [
        {
          id: 'e2e-tool-call-user',
          thread_id: threadId,
          turn_id: turnId,
          seq: 1,
          role: 'user',
          status: 'complete',
          workflow_id: request.workflow_id,
          content: { text: request.content }
        },
        {
          id: turnId,
          thread_id: threadId,
          turn_id: turnId,
          seq: 2,
          role: 'assistant',
          status: 'complete',
          content: {
            text: 'Found it.',
            tool_calls: [
              {
                id: 'call-1',
                tool_name: 'search_nodes',
                status: 'ok',
                duration_ms: 420
              },
              {
                // Deliberately 'success' (not 'ok', like call-1) to cover both terminal vocabularies.
                id: 'call-2',
                tool_name: 'add_node',
                status: 'success',
                duration_ms: 180
              }
            ]
          }
        }
      ]
      return route.fulfill(jsonRoute(messages))
    })

    // Settle the (WS-less) turn so the reload below is not racing a
    // permanently-streaming assistant message.
    await panel
      .getByRole('button', { name: enMessages.agent.stop, exact: true })
      .click()

    await page.reload()
    await expect(
      page.getByTestId('integrated-tab-bar-actions')
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 30_000 })
    const reopenedPanel = page.locator('#agent-panel-root')
    await expect(reopenedPanel).toBeVisible({ timeout: 30_000 })

    const summary = reopenedPanel.getByRole('button', {
      name: 'Ran 2 tool calls for 0.6 seconds',
      exact: true
    })
    await expect(summary).toBeVisible({ timeout: 10_000 })
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await expect(reopenedPanel.getByText('Search nodes')).toBeHidden()

    await summary.click()
    await expect(reopenedPanel.getByText('Search nodes')).toBeVisible()
    await expect(reopenedPanel.getByText('Add node')).toBeVisible()
    await expect(reopenedPanel.getByRole('listitem')).toHaveText([
      /^Search nodes\s*0\.4s$/,
      /^Add node\s*0\.2s$/
    ])
    const restoredThreadId = promptHistory.historyRequestThreadIds.at(-1)
    expect(restoredThreadId).toBeTruthy()

    await reopenedPanel
      .getByRole('button', { name: enMessages.agent.newChat })
      .click()
    await expect(summary).toHaveCount(0)
    await expect(reopenedPanel.getByTestId('user-message-bubble')).toHaveCount(
      0
    )
    await reopenedPanel
      .getByRole('button', { name: enMessages.agent.showChatHistory })
      .click()
    await reopenedPanel
      .getByRole('button', { name: 'Inline reference round trip', exact: true })
      .click()
    await expect
      .poll(() => promptHistory.historyRequestThreadIds.at(-1))
      .toBe(restoredThreadId)
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await expect(reopenedPanel.getByTestId('user-message-bubble')).toHaveText(
      'find a node for me'
    )
    await summary.click()
    await expect(reopenedPanel.getByText('Search nodes')).toBeVisible()
    await expect(reopenedPanel.getByText('Add node')).toBeVisible()
    await expect(reopenedPanel.getByRole('listitem')).toHaveText([
      /^Search nodes\s*0\.4s$/,
      /^Add node\s*0\.2s$/
    ])
  }
)
