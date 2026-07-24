import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  DRAFT_PATCH,
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  THINKING_EVENT,
  THINKING_TEXT,
  TOOL_CALL_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

test.describe('In-App Agent panel', { tag: '@cloud' }, () => {
  test.describe('flag off', () => {
    test.use({ agentFlagEnabled: false })

    test('does not expose the Ask Comfy Agent button', async ({
      comfyPage,
      postedMessages
    }) => {
      expect(postedMessages).toHaveLength(0)

      await expect(
        comfyPage.page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveCount(0)
    })
  })

  test('shows the greeting, inserts a suggested prompt, and completes a chat turn', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()

    await expect(panel.getByText(/^Hello/)).toBeVisible()
    await expect(panel.getByText('What do you want to make?')).toBeVisible()
    const firstPrompt = enMessages.agent.suggestedPrompts[0]
    const promptChip = panel.getByRole('button', { name: firstPrompt })
    await expect(promptChip).toBeVisible()

    const composer = panel.getByPlaceholder(enMessages.agent.placeholder)
    const sendButton = panel.getByRole('button', { name: 'Send' })

    await expect(composer).toHaveValue('')
    await promptChip.click()
    await expect(composer).toHaveValue(firstPrompt)
    expect(
      postedMessages,
      'inserting a prompt must not POST a message'
    ).toHaveLength(0)

    const ws = await getWebSocket()
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)
    expect(postedMessages[0]).toContain(firstPrompt)
    await expect(composer).toHaveValue('')

    pushEvent(ws, THINKING_EVENT)
    await expect(panel.getByText(THINKING_TEXT)).toBeVisible()

    pushEvent(ws, TOOL_CALL_EVENT)
    await expect(panel.getByText('Ran 1 tool call')).toBeVisible()
    await expect(panel.getByText(THINKING_TEXT)).toBeHidden()

    pushEvent(ws, MESSAGE_DELTA_EVENT)
    await expect(
      panel.locator('strong', { hasText: 'fully ready' })
    ).toBeVisible()

    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  })

  test('applies a draft_patch graph to the canvas', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const panel = page.locator('#agent-panel-root')

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()
    await expect(panel).toBeVisible()

    await panel.getByPlaceholder(enMessages.agent.placeholder).fill('Build it')
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

    const ws = await getWebSocket()
    pushEvent(ws, { type: 'draft_patch', data: DRAFT_PATCH })

    await expect
      .poll(() => page.evaluate(() => window.app!.graph!.nodes.length))
      .toBe(2)
    const nodeTypes = await page.evaluate(() =>
      window.app!.graph!.nodes.map((n) => n.type)
    )
    expect(nodeTypes).toEqual(
      expect.arrayContaining(['CheckpointLoaderSimple', 'SaveImage'])
    )
  })
})
