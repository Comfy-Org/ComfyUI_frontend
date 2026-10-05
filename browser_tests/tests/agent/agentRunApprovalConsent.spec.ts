import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { createI18n } from 'vue-i18n'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { AgentRunMode } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
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

const SEND_LABEL = enMessages.agent.send
const CARD_LEAD = enMessages.agent.runApproval.leadBound
const RUN_LABEL = enMessages.agent.runApproval.run
const CANCEL_LABEL = enMessages.agent.runApproval.cancel
const { t } = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global
const COMPOSER_LABEL = t('agent.placeholder')

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

/**
 * One POST the app made to the ask-answer endpoint. The URL is recorded
 * alongside the body because the body alone cannot show *which* ask was
 * answered — `{"selected":["run"]}` aimed at the wrong thread or a stale ask
 * would satisfy a body-only assertion while authorizing the wrong spend.
 */
interface AnswerCall {
  /** Decoded pathname, so the `:` inside `ASK_ID` compares literally. */
  path: string
  body: unknown
}

interface Turn {
  panel: Locator
  send: (frame: AgentWsEvent | HostFrame) => void
  answers: () => AnswerCall[]
}

const ANSWER_PATH = `/api/agent/threads/${THREAD_ID}/asks/${ASK_ID}/answer`
const QUESTION_ASK_ID = `${MESSAGE_ID}:call-ask`
const QUESTION_PATH = `/api/agent/threads/${THREAD_ID}/asks/${QUESTION_ASK_ID}/answer`
const QUESTION = 'Which styles should I try?'

function askUserQuestion(): AgentWsEvent {
  return {
    type: 'agent_ask',
    data: {
      ...ids,
      ask_id: QUESTION_ASK_ID,
      kind: 'ask_user',
      prompt: QUESTION,
      options: [
        { id: 'oil', label: 'Oil painting', description: 'Thick strokes' },
        { id: 'ink', label: 'Ink sketch' },
        { id: 'pixel', label: 'Pixel art' }
      ],
      min_selections: 1,
      max_selections: 2,
      allow_other: true
    }
  }
}

const DELETE_ASK_ID = `${MESSAGE_ID}:call-delete`
const DELETE_PATH = `/api/agent/threads/${THREAD_ID}/asks/${DELETE_ASK_ID}/answer`
const DELETE_PROMPT = 'Delete the 2 nodes you added?'

function deleteApproval(): AgentWsEvent {
  return {
    type: 'agent_ask',
    data: {
      ...ids,
      ask_id: DELETE_ASK_ID,
      kind: 'delete_approval',
      prompt: DELETE_PROMPT,
      options: [
        { id: 'delete', label: 'Delete' },
        { id: 'keep', label: 'Keep' }
      ],
      min_selections: 1,
      max_selections: 1,
      allow_other: false,
      context: {
        action: 'delete_nodes',
        nodes: [
          { id: 12, type: 'KSampler', title: 'Hero sampler' },
          { id: 13, type: 'VAEDecode' }
        ]
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

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
      if (!isRecord(frame)) return
      const { type, data } = frame
      if (type !== 'doc_subscribe' || !isRecord(data)) return
      const { workflow_id, state_vector_b64 } = data
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
  await new AgentPanel(page).open(30_000)

  await mockWorkflowPersistence(page, WORKFLOW_ID)

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
  return { panel, send, answers: () => answerCalls }
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
      const cancelButton = panel.getByRole('button', {
        name: CANCEL_LABEL,
        exact: true
      })
      await expect(panel.getByText(CARD_LEAD)).toBeVisible()
      await expect(runButton).toBeEnabled()
      await expect(cancelButton).toBeEnabled()

      // The card alone answered nothing: the ask is still open, so the
      // server-held run has not been authorized.
      expect(answers()).toHaveLength(0)

      // The user's click is the consent: exactly one answer, aimed at exactly
      // the ask they were shown, carrying exactly what they picked.
      await runButton.click()
      await expect.poll(() => answers().length).toBe(1)
      expect(answers()[0]).toEqual({
        path: ANSWER_PATH,
        body: { selected: ['run'] }
      })

      // Until the canonical resolution arrives, the card cannot answer again.
      await expect(runButton).toBeDisabled()
      await expect(cancelButton).toBeDisabled()
      expect(answers()).toHaveLength(1)

      send(askResolved(['run']))
      await expect(panel.getByText(CARD_LEAD)).toHaveCount(0)

      // The run becomes visible to the user as activity, not just as a final
      // message: the running frame puts a `run` row in the activity trace.
      // Asserted absent first so this cannot pass on some other 'Run' text —
      // the card's own button is already gone by here.
      const runActivity = panel.getByRole('listitem').filter({ hasText: 'Run' })
      await expect(runActivity).toHaveCount(0)
      send(toolCall('run', 'running'))
      await expect(runActivity.first()).toBeVisible()

      send(toolCall('run', 'success'))
      const done = 'Submitted. I will report back when it finishes.'
      send({ type: 'agent_message_delta', data: { delta: done, ...ids } })
      send({ type: 'agent_message_done', data: { ...ids, usage: null } })
      await expect(panel.getByText(done, { exact: true })).toBeVisible()
      expect(answers()).toHaveLength(1)
    })

    test('declining the card answers cancel exactly once', async ({ page }) => {
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
      expect(answers()[0]).toEqual({
        path: ANSWER_PATH,
        body: { selected: ['cancel'] }
      })

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

test.describe('Agent ask_user question', { tag: ['@cloud', '@agent'] }, () => {
  test('the card answers only the ask it shows and then reads back the answer', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { panel, send, answers } = await startTurn(page, 'Paint it.', 'auto')
    const choices = panel.getByRole('group', { name: QUESTION })
    const submit = panel.getByRole('button', { name: t('g.submit') })

    await test.step('the question arrives as a card with every option', async () => {
      send(askUserQuestion())
      await expect(
        choices.getByRole('checkbox', { name: 'Oil painting' })
      ).toBeVisible()
      await expect(
        choices.getByRole('checkbox', { name: 'Ink sketch' })
      ).toBeVisible()
      await expect(
        choices.getByRole('checkbox', { name: 'Pixel art' })
      ).toBeVisible()
      await expect(
        panel.getByText(t('agent.askUser.chooseUpTo', { max: 2 }))
      ).toBeVisible()
    })

    await test.step('answering posts once, to that ask', async () => {
      await choices.getByRole('checkbox', { name: 'Oil painting' }).click()
      await panel
        .getByRole('textbox', { name: t('agent.askUser.other') })
        .fill('watercolor')
      await submit.click()
      await expect.poll(() => answers().length).toBe(1)
      expect(answers()[0]).toEqual({
        path: QUESTION_PATH,
        body: { selected: ['oil'], other_text: 'watercolor' }
      })
    })

    await test.step('the resolved card reads back the answer', async () => {
      send({
        type: 'agent_ask_resolved',
        data: {
          ...ids,
          ask_id: QUESTION_ASK_ID,
          status: 'answered',
          selected: ['oil']
        }
      })
      const record = panel.getByRole('status').filter({
        hasText: t('agent.askUser.answered')
      })
      await expect(record).toContainText('Oil painting')
      // The frame names the ids, not the free text, so ours is not echoed.
      await expect(record).not.toContainText('watercolor')
      await expect(submit).toHaveCount(0)
      expect(answers()).toHaveLength(1)
    })
  })
})

test.describe('Agent delete approval', { tag: ['@cloud', '@agent'] }, () => {
  for (const { choice, label, otherLabel, readback } of [
    {
      choice: 'delete',
      label: t('agent.deleteApproval.delete'),
      otherLabel: t('agent.deleteApproval.keep'),
      readback: t('agent.deleteApproval.deleted')
    },
    {
      choice: 'keep',
      label: t('agent.deleteApproval.keep'),
      otherLabel: t('agent.deleteApproval.delete'),
      readback: t('agent.deleteApproval.kept')
    }
  ]) {
    test(`the card names the nodes and answers ${choice} only for the ask it shows`, async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { panel, send, answers } = await startTurn(page, 'Tidy up.', 'auto')
      const nodes = panel.getByRole('list', {
        name: t('agent.deleteApproval.nodes')
      })
      const button = panel.getByRole('button', { name: label, exact: true })
      const other = panel.getByRole('button', {
        name: otherLabel,
        exact: true
      })

      await test.step('the card lists the nodes it would delete', async () => {
        send(deleteApproval())
        await expect(panel.getByText(DELETE_PROMPT)).toBeVisible()
        await expect(nodes.getByRole('listitem')).toHaveText([
          /Hero sampler\s*#12/,
          /VAEDecode\s*#13/
        ])
        await expect(button).toBeEnabled()
        expect(answers()).toHaveLength(0)
      })

      await test.step('the click posts once, to that ask, and locks the card', async () => {
        await button.click()
        await expect.poll(() => answers().length).toBe(1)
        expect(answers()[0]).toEqual({
          path: DELETE_PATH,
          body: { selected: [choice] }
        })
        await expect(button).toBeDisabled()
        await expect(other).toBeDisabled()
      })

      await test.step('the resolved card reads back the answer', async () => {
        send({
          type: 'agent_ask_resolved',
          data: {
            ...ids,
            ask_id: DELETE_ASK_ID,
            status: 'answered',
            selected: [choice]
          }
        })
        await expect(
          panel.getByRole('status').filter({ hasText: readback })
        ).toBeVisible()
        await expect(button).toHaveCount(0)
        expect(answers()).toHaveLength(1)
      })
    })
  }
})
