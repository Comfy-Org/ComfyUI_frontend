import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { createI18n } from 'vue-i18n'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import { zAgentAnswerRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = 'b4d7e1f2-8a3c-4d5e-9f60-7a1b2c3d4e5f'
const THREAD_ID = 'd8c7b6a5-9e1f-4a2b-8c3d-4e5f6a7b8c9d'
const MESSAGE_ID = '1e2d3c4b-5a69-4788-9a7b-6c5d4e3f2a1b'
const SOCKET_SID = '8e2f3a4b-5c6d-4e7f-9a01-2b3c4d5e6f70'
const CATALOG: WidgetCatalog = { types: {} }
const SEED: WorkflowJSON = { nodes: [], links: [] }

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
const WORKING_LABEL = enMessages.agent.working
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

const ids = { thread_id: THREAD_ID, message_id: MESSAGE_ID }

function draft(text: string): AgentWsEvent {
  return { type: 'agent_message_draft', data: { text, ...ids } }
}

function toolCall(name: string, status: 'running' | 'success'): AgentWsEvent {
  return {
    type: 'agent_tool_call',
    data: {
      tool_call_id: `call-${name}`,
      tool_name: name,
      status,
      ...(status === 'success' && { duration_ms: 1200 }),
      ...ids
    }
  }
}

interface Turn {
  panel: Locator
  send: (frame: AgentWsEvent | HostFrame) => void
}

// Boots the agent panel on a fresh canvas and sends one user message, answering
// the document subscription the way the host does, so every frame after it is
// the agent's.
async function startTurn(page: Page, prompt: string): Promise<Turn> {
  const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
  let socket: WebSocketRoute | null = null
  const send = (frame: AgentWsEvent | HostFrame): void => {
    if (!socket) throw new Error('the app has not opened /ws yet')
    socket.send(JSON.stringify(frame))
  }

  await page.route('**/api/agent/threads', (route) =>
    route.fulfill(jsonRoute({ threads: [] }))
  )
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ ...ids, workflow_id: WORKFLOW_ID })
      })
    }
    return route.fulfill(jsonRoute([]))
  })
  await page.routeWebSocket(/\/ws/, (ws) => {
    socket = ws
    ws.send(
      JSON.stringify({
        type: 'status',
        data: { status: { exec_info: { queue_remaining: 0 } }, sid: SOCKET_SID }
      })
    )
    ws.onMessage((raw) => {
      const frame: unknown = JSON.parse(raw.toString())
      if (typeof frame !== 'object' || frame === null) return
      const { type, data } = frame as { type?: unknown; data?: unknown }
      if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
        return
      const { workflow_id, state_vector_b64 } = data as {
        workflow_id?: unknown
        state_vector_b64?: unknown
      }
      if (workflow_id !== WORKFLOW_ID || typeof state_vector_b64 !== 'string')
        return
      send(host.subscribed())
      send(host.catchUp(state_vector_b64))
    })
  })

  await bootAgentApp(page, true, {
    settings: { 'Comfy.Graph.CanvasInfo': false }
  })

  const panel = page.locator('#agent-panel-root')
  const topbarActions = page.getByTestId('integrated-tab-bar-actions')
  await expect(topbarActions).toHaveAttribute(
    'data-agent-gate-settled',
    'true',
    { timeout: 8_000 }
  )
  await topbarActions
    .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
    .click()
  await expect(panel).toBeVisible({ timeout: 30_000 })

  let savedName: string | undefined
  await page.route('**/api/userdata/*', (route) => {
    const request = route.request()
    const path = decodeURIComponent(
      new URL(request.url()).pathname.split('/userdata/')[1]
    )
    if (request.method() !== 'POST' || !path.startsWith('workflows/'))
      return route.fallback()
    savedName = path.slice('workflows/'.length, -'.json'.length)
    const saved: UserDataFullInfo = {
      path,
      modified: Date.now(),
      size: request.postDataBuffer()?.length ?? 0
    }
    return route.fulfill(jsonRoute(saved))
  })
  await page.route('**/api/workflows?*', (route) => {
    const workflows: WorkflowListResponse = {
      data:
        savedName === undefined
          ? []
          : [
              {
                id: WORKFLOW_ID,
                name: savedName,
                created_at: '2026-09-01T00:00:00Z',
                updated_at: '2026-09-01T00:00:00Z',
                created_by: 'test-user-e2e',
                latest_version: 1
              }
            ],
      pagination: {
        has_more: false,
        limit: 100,
        offset: 0,
        total: savedName === undefined ? 0 : 1
      }
    }
    return route.fulfill(jsonRoute(workflows))
  })

  const picker = panel.getByRole('button', {
    name: enMessages.agent.switchWorkflow
  })
  await picker.click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()
  await expect(picker).toHaveText('Unsaved Workflow')
  await expect.poll(() => socket !== null).toBe(true)

  await panel.getByRole('textbox', { name: COMPOSER_LABEL }).fill(prompt)
  await panel.getByRole('button', { name: SEND_LABEL }).click()
  await expect(panel.getByText(prompt).first()).toBeVisible()
  return { panel, send }
}

test.describe('Agent reply drafts', { tag: ['@cloud', '@agent'] }, () => {
  test('the answer appears while the model writes it, and the final answer replaces it', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { panel, send } = await startTurn(page, 'Make me a fox video.')

    // The render the user waited on has finished: the tool call settles and
    // the panel is left composing, with nothing but a spinner to show.
    send(toolCall('wait_for_job', 'running'))
    send(toolCall('wait_for_job', 'success'))
    await expect(panel.getByText(WORKING_LABEL)).toBeVisible()

    // The model's first words replace the spinner as it writes them.
    send(draft('Your fox video'))
    await expect(
      panel.getByText('Your fox video', { exact: true })
    ).toBeVisible()
    await expect(panel.getByText(WORKING_LABEL)).toHaveCount(0)

    // Each draft replaces the last rather than adding to it.
    send(draft('Your fox video is ready'))
    await expect(
      panel.getByText('Your fox video is ready', { exact: true })
    ).toBeVisible()
    await expect(
      panel.getByText('Your fox video', { exact: true })
    ).toHaveCount(0)

    // The delivered answer takes the draft's place: the reply reads once.
    const answer = 'Your fox video is ready — a red fox crossing fresh snow.'
    send({ type: 'agent_message_delta', data: { delta: answer, ...ids } })
    await expect(panel.getByText(answer, { exact: true })).toBeVisible()
    send({ type: 'agent_message_done', data: { ...ids, usage: null } })

    await expect(panel.getByRole('button', { name: SEND_LABEL })).toBeVisible()
    await expect(panel.getByRole('button', { name: STOP_LABEL })).toHaveCount(0)
    await expect(panel.getByText(answer, { exact: true })).toHaveCount(1)
  })

  test('a run-approval card takes the draft’s place', async ({ page }) => {
    test.setTimeout(60_000)
    const { panel, send } = await startTurn(page, 'Run it.')

    send(draft('Checking it once more'))
    await expect(
      panel.getByText('Checking it once more', { exact: true })
    ).toBeVisible()

    // The round was narration for a run that needs the user's approval: the
    // card arrives before the run's own tool call, which waits on the user.
    send({
      type: 'agent_thinking',
      data: { delta: 'Validated. Running it now.', ...ids }
    })
    send({
      type: 'agent_ask',
      data: {
        ...ids,
        ask_id: `${MESSAGE_ID}:call-run`,
        kind: 'run_approval',
        context: {
          workflow_id: WORKFLOW_ID,
          workflow_name: 'Unsaved Workflow'
        },
        prompt: 'Run workflow “Unsaved Workflow”?',
        options: [
          { id: 'run', label: 'Run' },
          { id: 'cancel', label: 'Cancel' }
        ],
        min_selections: 1,
        max_selections: 1,
        allow_other: false
      }
    })

    await expect(
      panel.getByText(enMessages.agent.runApproval.lead)
    ).toBeVisible()
    await expect(
      panel.getByRole('button', {
        name: enMessages.agent.runApproval.run,
        exact: true
      })
    ).toBeVisible()
    await expect(
      panel.getByText('Checking it once more', { exact: true })
    ).toHaveCount(0)
  })

  for (const selection of ['run', 'cancel'] as const) {
    test(`a completed turn keeps its ${selection} approval action live`, async ({
      page
    }) => {
      test.setTimeout(60_000)
      const askId = `${MESSAGE_ID}:call-${selection}`
      const answeredRequests: Array<{ url: string; selected: string[] }> = []
      await page.route(
        '**/api/agent/threads/*/asks/*/answer',
        async (route) => {
          const request = route.request()
          const body = zAgentAnswerRequest.parse(request.postDataJSON())
          answeredRequests.push({ url: request.url(), selected: body.selected })
          await route.fulfill({
            ...jsonRoute({ status: 'answered' }),
            status: 202
          })
        }
      )
      const { panel, send } = await startTurn(page, 'Run it when ready.')

      send({
        type: 'agent_ask',
        data: {
          ...ids,
          ask_id: askId,
          kind: 'run_approval',
          context: {
            workflow_id: WORKFLOW_ID,
            workflow_name: 'Unsaved Workflow'
          },
          prompt: 'Run workflow “Unsaved Workflow”?',
          options: [
            { id: 'run', label: 'Run' },
            { id: 'cancel', label: 'Cancel' }
          ],
          min_selections: 1,
          max_selections: 1,
          allow_other: false
        }
      })
      const action = panel.getByRole('button', {
        name: enMessages.agent.runApproval[selection],
        exact: true
      })
      await expect(action).toBeVisible()

      send({ type: 'agent_message_done', data: { ...ids, usage: null } })
      await expect(
        panel.getByRole('button', { name: SEND_LABEL })
      ).toBeVisible()
      await expect(action).toBeVisible()
      await action.click()

      test.fail(
        true,
        'The approval card remains visible after its turn completes, but its action no longer reaches the answer endpoint.'
      )
      await expect
        .poll(() => answeredRequests)
        .toEqual([
          {
            url: expect.stringContaining(
              `/threads/${THREAD_ID}/asks/${encodeURIComponent(askId)}/answer`
            ),
            selected: [selection]
          }
        ])
      await expect(action).toHaveAttribute('aria-busy', 'true')
      send({
        type: 'agent_ask_resolved',
        data: {
          ...ids,
          ask_id: askId,
          status: 'answered',
          selected: [selection]
        }
      })
      await expect(action).toHaveCount(0)
    })
  }
})
