import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { AgentAskServerFrame, AgentRunMode } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  ASK_WORKFLOW_ID,
  answerPath,
  askTurnIds
} from '@e2e/fixtures/data/agent/agentAskFrames'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const SOCKET_SID = '8e2f3a4b-5c6d-4e7f-9a01-2b3c4d5e6f70'
const CATALOG: WidgetCatalog = { types: {} }
const SEED: WorkflowJSON = { nodes: [], links: [] }

interface AnswerCall {
  path: string
  body: unknown
}

/** A turn parked in the agent panel, driven over a mocked socket. */
export interface AskTurn {
  panel: Locator
  send: (frame: AgentWsEvent | AgentAskServerFrame | HostFrame) => void
  answers: () => AnswerCall[]
  holdAnswer: (askId: string) => Promise<() => void>
  refuseAnswer: (askId: string, status: number) => Promise<void>
  questionCard: (prompt: string) => Locator
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAnswerTo(askId: string): (url: URL) => boolean {
  return (url) => decodeURIComponent(url.pathname) === answerPath(askId)
}

async function startAskTurn(
  page: Page,
  prompt: string,
  storedMode: AgentRunMode['mode']
): Promise<AskTurn> {
  const host = new HostDoc(ASK_WORKFLOW_ID, SEED, CATALOG)
  let socket: WebSocketRoute | null = null
  const send = (frame: AgentWsEvent | AgentAskServerFrame | HostFrame) => {
    if (!socket) throw new Error('the app has not opened /ws yet')
    socket.send(JSON.stringify(frame))
  }
  const answerCalls: AnswerCall[] = []

  const runMode: AgentRunMode = { mode: storedMode, credit_limit: null }
  await page.route('**/api/agent/run-mode', (route) =>
    route.fulfill(jsonRoute(runMode))
  )
  await page.route('**/api/agent/threads/*/asks/*/answer', (route) => {
    const request = route.request()
    answerCalls.push({
      path: decodeURIComponent(new URL(request.url()).pathname),
      body: request.postDataJSON()
    })
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
        body: JSON.stringify({ ...askTurnIds, workflow_id: ASK_WORKFLOW_ID })
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
      if (!isRecord(frame)) return
      const { type, data } = frame
      if (type !== 'doc_subscribe' || !isRecord(data)) return
      const { workflow_id, state_vector_b64 } = data
      if (
        workflow_id !== ASK_WORKFLOW_ID ||
        typeof state_vector_b64 !== 'string'
      )
        return
      send(host.subscribed())
      send(host.catchUp(state_vector_b64))
    })
  })

  await bootAgentApp(page, true, {
    settings: { 'Comfy.Graph.CanvasInfo': false }
  })

  const panel = page.locator('#agent-panel-root')
  await expect(page.getByTestId('integrated-tab-bar-actions')).toHaveAttribute(
    'data-agent-gate-settled',
    'true',
    { timeout: 8_000 }
  )
  await new AgentPanel(page).open(30_000)

  await mockWorkflowPersistence(page, ASK_WORKFLOW_ID)

  const picker = panel.getByRole('button', {
    name: enMessages.agent.switchWorkflow
  })
  await picker.click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()
  await expect(picker).toHaveText('Unsaved Workflow')
  await expect.poll(() => socket !== null).toBe(true)

  await panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL }).fill(prompt)
  await panel.getByRole('button', { name: enMessages.agent.send }).click()
  await expect(panel.getByText(prompt).first()).toBeVisible()

  return {
    panel,
    send,
    answers: () => answerCalls,
    holdAnswer: async (askId) => {
      let release = () => {}
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route(isAnswerTo(askId), async (route) => {
        await held
        await route.fallback()
      })
      return release
    },
    refuseAnswer: async (askId, status) => {
      await page.route(isAnswerTo(askId), (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'refused' })
        })
      )
    },
    questionCard: (prompt) =>
      panel
        .getByRole('group', { name: enMessages.agent.askUser.card })
        .filter({ hasText: prompt })
  }
}

export const agentAskTest = agentTest.extend<{
  startAskTurn: (
    prompt: string,
    storedMode: AgentRunMode['mode']
  ) => Promise<AskTurn>
}>({
  startAskTurn: async ({ page }, use) => {
    await use((prompt, storedMode) => startAskTurn(page, prompt, storedMode))
  }
})
