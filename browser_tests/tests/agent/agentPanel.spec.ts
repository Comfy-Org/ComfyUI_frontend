import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  DRAFT_PATCH,
  INTERMEDIATE_MESSAGE_EVENT,
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  OPEN_TAB_TOOL_EVENT,
  RESIZE_IMAGE_TOOL_EVENT,
  RESUMED_THINKING_EVENT,
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
  test.use({ connectWebSocketToServer: false })

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

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
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
    const firstSummary = panel.getByRole('button', {
      name: 'Ran 1 tool call for 1.3 seconds'
    })
    await expect(firstSummary).toBeVisible()
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByText('Set widget')).toBeVisible()
    await expect(panel.getByText(THINKING_TEXT)).toBeHidden()

    pushEvent(ws, INTERMEDIATE_MESSAGE_EVENT)
    await expect(
      panel.getByText(
        'The first graph edit is complete. I will check the remaining work.'
      )
    ).toBeVisible()
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByText('Set widget')).toBeVisible()

    pushEvent(ws, RESUMED_THINKING_EVENT)
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toBeVisible()

    pushEvent(ws, OPEN_TAB_TOOL_EVENT)

    const secondSummary = panel.getByRole('button', {
      name: 'Ran 1 tool call for 0.5 seconds'
    })
    await expect(secondSummary).toBeVisible()
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByText('Set widget')).toBeVisible()
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toHaveCount(0)

    pushEvent(ws, RESIZE_IMAGE_TOOL_EVENT)

    const finalSummary = panel.getByRole('button', {
      name: 'Ran 2 tool calls for 0.7 seconds'
    })
    await expect(finalSummary).toBeVisible()
    await expect(finalSummary).toHaveAttribute('aria-expanded', 'true')
    await expect(
      panel.getByRole('button', {
        name: /^Ran \d+ tool calls?(?: for \d+(?:\.\d+)? seconds)?$/
      })
    ).toHaveCount(2)
    await expect(firstSummary).toHaveCount(1)
    await expect(secondSummary).toHaveCount(0)

    const toolRows = panel.getByRole('listitem')
    await expect(toolRows).toHaveCount(3)
    await expect(toolRows.filter({ hasText: 'Set widget' })).toBeVisible()
    await expect(
      toolRows.filter({ hasText: 'Opened a new tab' }).getByText('0.5s')
    ).toBeVisible()
    await expect(
      toolRows.filter({ hasText: 'Resize image node' }).getByText('0.2s')
    ).toBeVisible()

    pushEvent(ws, MESSAGE_DELTA_EVENT)
    await expect(
      panel.locator('strong', { hasText: 'fully ready' })
    ).toBeVisible()

    pushEvent(ws, RESUMED_THINKING_EVENT)
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toBeVisible()
    await expect(finalSummary).toHaveAttribute('aria-expanded', 'true')
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByText('Opened a new tab')).toBeVisible()

    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
    await expect(
      panel.getByRole('button', { name: /ran 2 tool calls/i })
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false')
  })

  test('keeps the Agent scrollbar track transparent', async ({ comfyPage }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const scrollContainer = page
      .locator('#agent-panel-root div.overflow-y-auto')
      .first()
    await expect(scrollContainer).toBeVisible()

    const track = await scrollContainer.evaluate((element) => ({
      backgroundColor: getComputedStyle(element, '::-webkit-scrollbar-track')
        .backgroundColor,
      backgroundImage: getComputedStyle(element, '::-webkit-scrollbar-track')
        .backgroundImage,
      scrollbarColor: getComputedStyle(element).scrollbarColor
    }))

    expect(track.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(track.backgroundImage).toBe('none')
    expect(track.scrollbarColor).toMatch(/rgba\(0, 0, 0, 0\)$/)
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

    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Build it')
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
