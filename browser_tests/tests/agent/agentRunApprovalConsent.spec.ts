import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { createI18n } from 'vue-i18n'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { AgentRunMode, WorkflowListResponse } from '@comfyorg/ingest-types'

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

// The consent contract this suite pins (fire-2, PM-1494 / PM-1450, slack-18):
// a run_approval ask blocks the run on the user's explicit answer. The server
// holds the run; the panel's whole job is to show the card, send exactly the
// answer the user picked, and never answer on its own. Three independent
// 2026-09-21 reports ("Ask mode doesn't ask to run the workflow") came from
// the server-side gate being disabled while the picker still said Ask — so
// this suite also guards the client half: no code path may self-approve a
// spend, whatever the stored preference claims.

const WORKFLOW_ID = 'b4d7e1f2-8a3c-4d5e-9f60-7a1b2c3d4e5f'
const THREAD_ID = 'd8c7b6a5-9e1f-4a2b-8c3d-4e5f6a7b8c9d'
const MESSAGE_ID = '1e2d3c4b-5a69-4788-9a7b-6c5d4e3f2a1b'
const ASK_ID = `${MESSAGE_ID}:call-run`
const SOCKET_SID = '8e2f3a4b-5c6d-4e7f-9a01-2b3c4d5e6f70'
const CATALOG: WidgetCatalog = { types: {} }
const SEED: WorkflowJSON = { nodes: [], links: [] }

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const CARD_LEAD = enMessages.agent.runApproval.lead
const RUN_LABEL = enMessages.agent.runApproval.run
const CANCEL_LABEL = enMessages.agent.runApproval.cancel
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

const ids = { thread_id: THREAD_ID, message_id: MESSAGE_ID }

function runApprovalAsk(): AgentWsEvent {
  return {
    type: 'agent_ask',
    data: {
      ...ids,
      ask_id: ASK_ID,
      kind: 'run_approval',
      context: { workflow_id: WORKFLOW_ID, workflow_name: 'Unsaved Workflow' },
      prompt: 'Run workflow “Unsaved Workflow”?',
      options: [
        { id: 'run', label: 'Run' },
        { id: 'cancel', label: 'Cancel' }
      ],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }
  }
}

function askResolved(selected: string[]): AgentWsEvent {
  return {
    type: 'agent_ask_resolved',
    data: { ...ids, ask_id: ASK_ID, status: 'answered', selected }
  }
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
  /** Bodies of every POST the app made to the ask-answer endpoint. */
  answers: () => unknown[]
}

// Boots the panel against fully mocked endpoints and sends one user message.
// `storedMode` is what GET /api/agent/run-mode reports as the saved
// preference; the answer endpoint records every call it receives.
async function startTurn(
  page: Page,
  prompt: string,
  storedMode: AgentRunMode['mode']
): Promise<Turn> {
  const host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
  let socket: WebSocketRoute | null = null
  const send = (frame: AgentWsEvent | HostFrame): void => {
    if (!socket) throw new Error('the app has not opened /ws yet')
    socket.send(JSON.stringify(frame))
  }
  const answerBodies: unknown[] = []

  const runMode: AgentRunMode = { mode: storedMode, credit_limit: null }
  await page.route('**/api/agent/run-mode', (route) =>
    route.fulfill(jsonRoute(runMode))
  )
  await page.route('**/api/agent/threads/*/asks/*/answer', (route) => {
    answerBodies.push(route.request().postDataJSON())
    return route.fulfill(jsonRoute({ status: 'answered' }))
  })
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
  return { panel, send, answers: () => answerBodies }
}

test.describe(
  'Agent run approval consent',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('in Ask mode the run waits on the card, and only the user’s click answers it', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { panel, send, answers } = await startTurn(
        page,
        'Run it.',
        'ask_approval'
      )

      send(runApprovalAsk())
      const runButton = panel.getByRole('button', {
        name: RUN_LABEL,
        exact: true
      })
      await expect(panel.getByText(CARD_LEAD)).toBeVisible()
      await expect(runButton).toBeEnabled()

      // The card alone answered nothing: the ask is still open, so the
      // server-held run has not been authorized.
      expect(answers()).toHaveLength(0)

      // The user's click is the consent: exactly one answer, and it carries
      // exactly what they picked.
      await runButton.click()
      await expect.poll(() => answers().length).toBe(1)
      expect(answers()[0]).toEqual({ selected: ['run'] })

      // Until the canonical resolution arrives, the card cannot answer again.
      await expect(runButton).toBeDisabled()
      expect(answers()).toHaveLength(1)

      // Only now does the run happen, in full view of the user.
      send(askResolved(['run']))
      await expect(panel.getByText(CARD_LEAD)).toHaveCount(0)
      send(toolCall('run', 'running'))
      send(toolCall('run', 'success'))
      const done = 'Submitted. I will report back when it finishes.'
      send({ type: 'agent_message_delta', data: { delta: done, ...ids } })
      send({ type: 'agent_message_done', data: { ...ids, usage: null } })
      await expect(panel.getByText(done, { exact: true })).toBeVisible()
      expect(answers()).toHaveLength(1)
    })

    test('declining the card answers cancel, and no run follows', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { panel, send, answers } = await startTurn(
        page,
        'Run it.',
        'ask_approval'
      )

      send(runApprovalAsk())
      await expect(panel.getByText(CARD_LEAD)).toBeVisible()
      await panel
        .getByRole('button', { name: CANCEL_LABEL, exact: true })
        .click()
      await expect.poll(() => answers().length).toBe(1)
      expect(answers()[0]).toEqual({ selected: ['cancel'] })

      send(askResolved(['cancel']))
      await expect(panel.getByText(CARD_LEAD)).toHaveCount(0)
      const done = 'Understood — I won’t run it.'
      send({ type: 'agent_message_delta', data: { delta: done, ...ids } })
      send({ type: 'agent_message_done', data: { ...ids, usage: null } })
      await expect(panel.getByText(done, { exact: true })).toBeVisible()
      expect(answers()).toHaveLength(1)
    })

    test('the panel never answers a run approval by itself, whatever the stored preference says', async ({
      page
    }) => {
      test.setTimeout(60_000)
      // The stored preference reads `auto` while the server still raised an
      // ask — the divergence produced by a stale cached mode. Auto-approving
      // from the client copy would spend money the server's gate was holding;
      // the card must wait for the user regardless.
      const { panel, send, answers } = await startTurn(page, 'Run it.', 'auto')

      send(runApprovalAsk())
      const runButton = panel.getByRole('button', {
        name: RUN_LABEL,
        exact: true
      })
      await expect(panel.getByText(CARD_LEAD)).toBeVisible()
      await expect(runButton).toBeEnabled()

      // Flush a later frame through the same pipeline so the ask has been
      // fully processed before asserting nothing answered it.
      const draft = 'Waiting on your approval.'
      send({ type: 'agent_message_draft', data: { text: draft, ...ids } })
      await expect(panel.getByText(draft, { exact: true })).toBeVisible()

      expect(answers()).toHaveLength(0)
      await expect(runButton).toBeEnabled()
      await expect(panel.getByText(CARD_LEAD)).toBeVisible()
    })
  }
)
