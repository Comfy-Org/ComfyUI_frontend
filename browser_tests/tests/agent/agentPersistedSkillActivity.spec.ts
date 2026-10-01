import { expect } from '@playwright/test'

import type { AgentMessage, ToolCallSummary } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// PM-1193: a reloaded `load_skill` row read "Load skill" instead of naming the
// skill it had loaded. The live frame carries the name and the backend persists
// it on the row's `content.tool_calls`, but `zAgentMessageContent.tool_calls`
// typed its elements with the generated `zToolCallSummary`, which has no
// `skill` key and no `.passthrough()` — so Zod stripped the field at the
// `getMessages` boundary, before `normalizeAgentTranscript` ever looked for it.
// The companion unit test lives in agentTranscript.test.ts; this one proves it
// through the surface the user actually reads, since the stripping happened one
// layer above the parser the unit test drives.
//
// Shaped after agentToolCallHistoryPersistence.spec.ts, whose own GET mock does
// not carry `skill`; the 120s budget is that spec's, for the same reload.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'names the loaded skill in a reloaded work summary',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    await new AgentPanel(page).open()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    // Send is gated behind an explicit workflow target, so without this the
    // click below never reaches promptHistory.
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.pressSequentially('Use the comfy-director skill')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    // The real ingest API returns the row's `content` map verbatim, so a
    // resolved `load_skill` call arrives with its `skill` alongside the fields
    // the generated `ToolCallSummary` declares.
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const request = promptHistory.requests.at(0)
      if (!request) return route.fallback()
      const threadId = new URL(route.request().url()).pathname
        .split('/')
        .at(-2)!
      promptHistory.historyRequestThreadIds.push(threadId)
      const turnId = 'e2e-persisted-skill-turn'
      // `skill` is not declared on the generated `ToolCallSummary`, which is
      // the whole point: the response really does carry it, and the schema
      // boundary is what decides whether the frontend ever sees it.
      const loadSkillCall: ToolCallSummary & { skill: string } = {
        id: 'call-load-skill',
        tool_call_id: 'call-load-skill',
        tool_name: 'load_skill',
        status: 'success',
        duration_ms: 310,
        skill: 'comfy-director'
      }
      const messages: AgentMessage[] = [
        {
          id: 'e2e-persisted-skill-user',
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
            text: 'Loaded it.',
            tool_calls: [loadSkillCall]
          }
        }
      ]
      return route.fulfill(jsonRoute(messages))
    })

    // Settle the (WS-less) turn so the reload is not racing a permanently
    // streaming assistant message.
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
      name: enMessages.agent.worked,
      exact: true
    })
    await expect(summary).toBeVisible({ timeout: 10_000 })
    await summary.click()

    await expect(
      reopenedPanel.getByTestId('agent-activity-trace').getByRole('listitem')
    ).toHaveText(['Loaded comfy-director'])
  }
)
