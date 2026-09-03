import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  INTERMEDIATE_MESSAGE_EVENT,
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  OPEN_TAB_TOOL_EVENT,
  RESIZE_IMAGE_TOOL_EVENT,
  RESUMED_THINKING_EVENT,
  SOCKET_READY_EVENT,
  THINKING_EVENT,
  THINKING_TEXT,
  TOOL_CALL_EVENT,
  WORKFLOW_ID,
  agentDocSubscribed,
  agentWorkflowUpdates,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'
import type { AgentWireFrame } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

function pushEvent(
  ws: WebSocketRoute,
  event: AgentWsEvent | AgentWireFrame
): void {
  ws.send(JSON.stringify(event))
}

function isWorkflowSubscribe(message: string): boolean {
  return workflowSubscribeStateVector(message) !== undefined
}

function workflowSubscribeStateVector(message: string): string | undefined {
  try {
    const frame: unknown = JSON.parse(message)
    if (typeof frame !== 'object' || frame === null) return
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
      return
    const subscribe = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (subscribe.workflow_id !== WORKFLOW_ID) return
    return typeof subscribe.state_vector_b64 === 'string'
      ? subscribe.state_vector_b64
      : undefined
  } catch {
    return
  }
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
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.getByText('Set widget')).toBeHidden()

    pushEvent(ws, RESUMED_THINKING_EVENT)
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toBeVisible()
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.getByText('Set widget')).toBeHidden()

    pushEvent(ws, OPEN_TAB_TOOL_EVENT)

    const secondSummary = panel.getByRole('button', {
      name: 'Ran 1 tool call for 0.5 seconds'
    })
    await expect(secondSummary).toBeVisible()
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.getByText('Set widget')).toBeHidden()
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
    await expect(toolRows).toHaveCount(2)
    await expect(toolRows.filter({ hasText: 'Set widget' })).toHaveCount(0)
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
    await expect(finalSummary).toHaveAttribute('aria-expanded', 'false')
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.getByText('Opened a new tab')).toBeHidden()

    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
    await expect(
      panel.getByRole('button', { name: /ran 2 tool calls/i })
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false')
  })

  test('retains the agent doc and requests a delta after reconnect', async ({
    comfyPage,
    getWebSocket,
    postedMessages,
    webSocketMessages
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    await comfyPage.workflow.loadWorkflow('default')
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    const panel = page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const ws = await getWebSocket()
    await composer.fill('Add a node to this workflow')
    await panel.getByRole('button', { name: 'Send' }).click()

    await expect.poll(() => postedMessages.length, { timeout: 10_000 }).toBe(1)
    await expect(panel.getByRole('button', { name: 'Stop' })).toBeVisible()
    pushEvent(ws, SOCKET_READY_EVENT)
    await expect
      .poll(() => webSocketMessages.some(isWorkflowSubscribe), {
        timeout: 10_000
      })
      .toBe(true)

    pushEvent(ws, agentDocSubscribed())
    const updates = agentWorkflowUpdates()
    pushEvent(ws, updates.initial)

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.app!.graph._nodes.some(
              (node) =>
                String(node.id) === '41' && node.title === 'Agent-created node'
            )
          ),
        { timeout: 10_000 }
      )
      .toBe(true)

    const messagesBeforeReconnect = webSocketMessages.length
    await ws.close()
    await expect
      .poll(
        () =>
          webSocketMessages
            .slice(messagesBeforeReconnect)
            .filter(isWorkflowSubscribe).length,
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(1)

    const reconnectSubscribe = webSocketMessages
      .slice(messagesBeforeReconnect)
      .map(workflowSubscribeStateVector)
      .find((stateVector) => stateVector !== undefined)
    expect(reconnectSubscribe).toBe(updates.initialStateVector)

    const reconnectedWs = await getWebSocket()
    pushEvent(reconnectedWs, agentDocSubscribed())
    pushEvent(reconnectedWs, updates.reconnectDelta)

    await expect(panel.getByTestId('agent-crdt-status')).toContainText(
      '2 updates',
      { timeout: 10_000 }
    )

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.app!.graph._nodes.filter(
                (node) => String(node.id) === '41'
              ).length
          ),
        { timeout: 10_000 }
      )
      .toBe(1)
  })

  test.describe('composer sizing', () => {
    test.use({ viewport: { width: 1920, height: 1080 } })

    test('caps long text at 400px and scrolls internally', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

      const panel = page.locator('#agent-panel-root')
      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })

      await composer.fill('A growing prompt line\n'.repeat(14))
      await expect
        .poll(() =>
          composer.evaluate((element) =>
            Math.round(element.getBoundingClientRect().height)
          )
        )
        .toBeGreaterThan(200)

      await composer.fill('An overflowing prompt line\n'.repeat(60))
      await expect
        .poll(() =>
          composer.evaluate((element) => ({
            height: Math.round(element.getBoundingClientRect().height),
            scrolls: element.scrollHeight > element.clientHeight
          }))
        )
        .toEqual({ height: 400, scrolls: true })
      await expect(
        panel.getByText('What do you want to make?')
      ).toBeInViewport()

      await panel
        .getByRole('button', { name: enMessages.agent.maximize })
        .click()
      await expect
        .poll(() =>
          composer.evaluate((element) => ({
            height: Math.round(element.getBoundingClientRect().height),
            scrolls: element.scrollHeight > element.clientHeight
          }))
        )
        .toEqual({ height: 400, scrolls: true })
      await expect(
        panel.getByText('What do you want to make?')
      ).toBeInViewport()
    })
  })

  test('T-28 / PM-677 / FE-1320 keeps the Agent scrollbar track transparent', async ({
    comfyPage
  }) => {
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

  test('sizes the add-to-prompt menu around its longest item', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const panel = page.locator('#agent-panel-root')
    await panel
      .getByRole('button', { name: enMessages.agent.addToPrompt })
      .click()

    const menu = page.getByRole('menu')
    const longestItem = menu.getByRole('menuitem', {
      name: enMessages.agent.addFromAssets
    })
    const icon = longestItem.locator('span').first()
    const label = longestItem.getByText(enMessages.agent.addFromAssets, {
      exact: true
    })

    await expect(longestItem).toBeVisible()
    await expect
      .poll(() => menu.boundingBox().then((box) => box?.width))
      .toBeGreaterThan(186)
    await expect
      .poll(async () => {
        const [itemBox, iconBox, labelBox] = await Promise.all([
          longestItem.boundingBox(),
          icon.boundingBox(),
          label.boundingBox()
        ])
        if (!itemBox || !iconBox || !labelBox) return Number.POSITIVE_INFINITY

        const leftInset = iconBox.x - itemBox.x
        const rightInset =
          itemBox.x + itemBox.width - (labelBox.x + labelBox.width)
        return Math.abs(leftInset - rightInset)
      })
      .toBeLessThanOrEqual(1)
  })

  test('exits node selection when the active workflow changes', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const panel = page.locator('#agent-panel-root')
    await panel
      .getByRole('button', { name: enMessages.agent.addToPrompt })
      .click()
    await page
      .getByRole('menuitem', { name: enMessages.agent.addNodesFromGraph })
      .click()
    const selectionBanner = page.getByTestId('node-selection-mode-banner')
    await expect(selectionBanner).toBeVisible()

    await comfyPage.menu.topbar.newWorkflowButton.click()

    await expect(selectionBanner).toHaveCount(0)
  })

  test('edits and resubmits the last prompt after stopping its turn', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const panel = page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const originalPrompt = 'Build a rainy city at night'
    const revisedPrompt = 'Build a rainy city at sunrise'

    await composer.fill(originalPrompt)
    await panel.getByRole('button', { name: enMessages.agent.send }).click()
    await expect.poll(() => postedMessages.length).toBe(1)

    await expect(
      panel.getByRole('button', { name: enMessages.g.edit })
    ).toHaveCount(0)
    await panel.getByRole('button', { name: enMessages.agent.stop }).click()
    await expect(
      panel.getByRole('button', { name: enMessages.g.edit })
    ).toHaveCount(0)

    pushEvent(await getWebSocket(), MESSAGE_DONE_EVENT)
    const editButton = panel.getByRole('button', { name: enMessages.g.edit })
    await expect(editButton).toHaveCount(1)
    await editButton.click()

    await expect(composer).toHaveValue(originalPrompt)
    await expect(composer).toBeFocused()

    await composer.fill(revisedPrompt)
    await panel.getByRole('button', { name: enMessages.agent.send }).click()
    await expect.poll(() => postedMessages.length).toBe(2)
    expect(postedMessages[1]).toContain(revisedPrompt)
  })
})
