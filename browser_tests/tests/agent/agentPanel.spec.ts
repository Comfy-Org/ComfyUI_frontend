import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
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

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

// Parsed through the generated admission contract so a server-side rename of a
// `reason` or `type` breaks this fixture instead of silently passing.
const NO_FUNDS_ERROR = zAgentAdmissionError.parse({
  error: {
    message: 'Add credits to continue.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

test.describe('In-App Agent panel', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.describe('flag off', () => {
    test.use({ agentFlagEnabled: false })

    test('does not expose the Agent button', async ({
      agentPanel,
      postedMessages
    }) => {
      expect(postedMessages).toHaveLength(0)

      await expect(agentPanel.openButton).toHaveCount(0)
    })
  })

  test('shows the greeting, inserts a suggested prompt, and completes a chat turn', async ({
    agentPanel,
    postedMessages,
    getWebSocket
  }) => {
    test.setTimeout(30_000)

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root

    await expect(panel.getByText(/^Hello/)).toBeVisible()
    await expect(panel.getByText('What do you want to make?')).toBeVisible()
    const firstPrompt = enMessages.agent.suggestedPrompts[0]
    const promptChip = panel.getByRole('button', { name: firstPrompt })
    await expect(promptChip).toBeVisible()

    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const sendButton = panel.getByRole('button', { name: 'Send' })

    await expect(composer).toHaveText('')
    await promptChip.click()
    await expect(composer).toHaveText(firstPrompt)
    expect(
      postedMessages,
      'inserting a prompt must not POST a message'
    ).toHaveLength(0)

    const ws = await getWebSocket()
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)
    expect(postedMessages[0]).toContain(firstPrompt)
    await expect(composer).toHaveText('')

    pushEvent(ws, THINKING_EVENT)
    await expect(panel.getByText(THINKING_TEXT)).toBeVisible()

    pushEvent(ws, TOOL_CALL_EVENT)
    const summary = panel.getByRole('button', { name: /^Worked for / })
    await expect(summary).toHaveCount(0)
    await expect(panel.getByText('Set widget')).toBeVisible()
    await expect(panel.getByText(THINKING_TEXT, { exact: true })).toBeVisible()
    await expect(
      panel.getByText(enMessages.agent.working, { exact: true })
    ).toBeVisible()

    pushEvent(ws, INTERMEDIATE_MESSAGE_EVENT)
    await expect(
      panel.getByText(
        'The first graph edit is complete. I will check the remaining work.'
      )
    ).toBeVisible()
    await expect(summary).toHaveCount(0)
    await expect(panel.getByText('Set widget')).toBeVisible()
    await expect(
      panel.getByText(enMessages.agent.working, { exact: true })
    ).toHaveCount(0)

    pushEvent(ws, RESUMED_THINKING_EVENT)
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toBeVisible()
    await expect(summary).toHaveCount(0)
    await expect(panel.getByText('Set widget')).toBeVisible()

    pushEvent(ws, OPEN_TAB_TOOL_EVENT)

    await expect(summary).toHaveCount(0)
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toBeVisible()

    pushEvent(ws, RESIZE_IMAGE_TOOL_EVENT)

    await expect(summary).toHaveCount(0)

    const activityRows = panel.getByRole('listitem')
    await expect(activityRows).toHaveCount(5)
    await expect(activityRows.filter({ hasText: 'Set widget' })).toBeVisible()
    await expect(
      activityRows.filter({ hasText: 'Opened a new tab' }).getByText('0.5s')
    ).toBeVisible()
    await expect(
      activityRows.filter({ hasText: 'Resize image node' }).getByText('0.2s')
    ).toBeVisible()

    pushEvent(ws, MESSAGE_DELTA_EVENT)
    await expect(
      panel.locator('strong', { hasText: 'fully ready' })
    ).toBeVisible()
    await expect(activityRows).toHaveCount(5)

    pushEvent(ws, RESUMED_THINKING_EVENT)
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toHaveCount(2)
    await expect(activityRows).toHaveCount(6)
    await expect(summary).toHaveCount(0)
    await expect(panel.getByText('Opened a new tab')).toBeVisible()

    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
    await expect(summary).toHaveCount(1)
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await expect(activityRows).toHaveCount(0)
    await expect(
      panel.locator('strong', { hasText: 'fully ready' })
    ).toBeVisible()

    await summary.click()
    await expect(summary).toHaveAttribute('aria-expanded', 'true')
    await expect(activityRows).toHaveCount(6)
    await expect(panel.getByText(THINKING_TEXT, { exact: true })).toBeVisible()
    await expect(
      panel.getByText('Checking the remaining edits.', { exact: true })
    ).toHaveCount(2)
    await expect(panel.getByText('Set widget')).toBeVisible()
    await expect(panel.getByText('Opened a new tab')).toBeVisible()
    await expect(panel.getByText('Resize image node')).toBeVisible()
  })

  test('shows an admission paywall without losing the rejected prompt', async ({
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page
    const panel = agentPanel.root
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const prompt = 'Build a product photo workflow'

    await test.step('reject the next turn with a no-funds admission error', async () => {
      // Scoped to POST so the fixture's GET handler for the same URL still
      // serves the thread's message history.
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        await route.fulfill({
          status: 402,
          contentType: 'application/json',
          body: JSON.stringify(NO_FUNDS_ERROR)
        })
      })
    })

    await test.step('open the agent panel on a workflow', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    await test.step('send a prompt the server will reject', async () => {
      await composer.fill(prompt)
      await panel.getByRole('button', { name: 'Send' }).click()
    })

    await test.step('keep the rejected prompt and surface the paywall', async () => {
      await expect(panel.getByTestId('user-message-bubble')).toHaveText(prompt)
      await expect(composer).toHaveText(prompt)
      const paywall = panel.getByRole('alert')
      await expect(paywall).toContainText(enMessages.agent.paywall.title)
      await expect(paywall).toContainText('Add credits to continue.')
    })
  })

  test.describe('diagnostic report', () => {
    test.use({
      permissions: ['clipboard-read', 'clipboard-write'],
      crdtDebugEnabled: true
    })

    test('copies retained tool metadata with privacy sources turned off', async ({
      agentPanel,
      comfyPage,
      getWebSocket
    }) => {
      await test.step('turn off every optional privacy source', async () => {
        await agentPanel.open()
        await expect(agentPanel.debugHeading).toBeVisible()
        await agentPanel.turnOffOptionalReportSources()
      })

      await test.step('retain tool metadata without conversation content', async () => {
        await agentPanel.selectWorkflow()
        const composer = agentPanel.root.getByRole('textbox', {
          name: /^Describe ideas/
        })
        await composer.fill('private diagnostic prompt')
        await agentPanel.root.getByRole('button', { name: 'Send' }).click()
        await expect(
          agentPanel.root.getByRole('button', { name: 'Stop' })
        ).toBeVisible()
        const ws = await getWebSocket()
        pushEvent(ws, THINKING_EVENT)
        await expect(
          agentPanel.root.getByText(THINKING_TEXT, { exact: true })
        ).toBeVisible()

        pushEvent(ws, TOOL_CALL_EVENT)
        await expect(agentPanel.root.getByText('Set widget')).toBeVisible()
      })

      await test.step('copy a report with bounded tool metadata', async () => {
        await agentPanel.copyReportButton.click()
        await expect(agentPanel.copiedButton).toBeVisible()
        await expect
          .poll(async () => {
            const report = await comfyPage.clipboard.readText()
            return {
              serverLogs: report.includes('- Server logs: turned off'),
              settings: report.includes('- Settings: turned off'),
              workflow: report.includes('- Workflow: turned off'),
              toolStatus: report.includes(
                '- Agent tool calls: collected (1/1 retained calls)'
              ),
              toolName: report.includes('"name": "set_widget"'),
              privateThinking: report.includes(THINKING_TEXT)
            }
          })
          .toEqual({
            serverLogs: true,
            settings: true,
            workflow: true,
            toolStatus: true,
            toolName: true,
            privateThinking: false
          })
      })
    })
  })

  test.describe('composer sizing', () => {
    test.use({
      viewport: { width: 1920, height: 1080 },
      permissions: ['clipboard-read', 'clipboard-write']
    })

    test('caps long text at 400px and scrolls internally', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()

      const panel = agentPanel.root
      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      const input = panel.getByTestId('composer-inline-input')

      await comfyPage.clipboard.writeText('A growing prompt line\n'.repeat(14))
      await composer.press('ControlOrMeta+v')
      await expect
        .poll(() =>
          input.evaluate((element) =>
            Math.round(element.getBoundingClientRect().height)
          )
        )
        .toBeGreaterThan(200)

      await comfyPage.clipboard.writeText(
        'An overflowing prompt line\n'.repeat(60)
      )
      await composer.press('ControlOrMeta+a')
      await composer.press('ControlOrMeta+v')
      await expect
        .poll(() =>
          input.evaluate((element) => ({
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
          input.evaluate((element) => ({
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
    agentPanel
  }) => {
    await agentPanel.open()

    const scrollContainer = agentPanel.root
      .locator('div.overflow-y-auto')
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
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page
    await agentPanel.open()

    const panel = agentPanel.root
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

  test('uses the server upload limit for Agent file attachments', async ({
    comfyPage,
    agentPanel
  }) => {
    test.setTimeout(60_000)
    const page = comfyPage.page
    let uploadCount = 0
    await page.route('**/api/upload/image', async (route) => {
      uploadCount += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'uploaded_movie.mp4',
          subfolder: '',
          type: 'input'
        })
      })
    })
    await page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        max_upload_size: 24 * 1024 * 1024
      }
    })

    await agentPanel.open()
    const panel = page.locator('#agent-panel-root')
    const fileInput = panel.getByTestId('agent-file-input')

    const uploadResponse = page.waitForResponse('**/api/upload/image')
    await fileInput.setInputFiles({
      name: 'movie.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.alloc(21 * 1024 * 1024)
    })
    expect((await uploadResponse).ok()).toBe(true)
    await expect(
      panel.getByTestId('composer-asset-section').getByText('movie.mp4')
    ).toBeVisible()
    await expect.poll(() => uploadCount).toBe(1)

    await fileInput.setInputFiles({
      name: 'too-large.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.alloc(25 * 1024 * 1024)
    })
    await expect(
      page.getByText('too-large.mp4 is larger than 24 MB')
    ).toBeVisible()
    await expect(panel.getByText('too-large.mp4', { exact: true })).toHaveCount(
      0
    )
    await expect.poll(() => uploadCount).toBe(1)
  })

  test('exits node selection when the active workflow changes', async ({
    agentPanel,
    comfyPage
  }) => {
    const page = comfyPage.page
    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const panel = agentPanel.root
    await panel
      .getByRole('button', { name: enMessages.agent.addToPrompt })
      .click()
    await page.getByRole('menuitem', { name: enMessages.agent.nodes }).click()
    const selectionBanner = page.getByTestId('node-selection-mode-banner')
    await expect(selectionBanner).toBeVisible()

    await comfyPage.menu.topbar.newWorkflowButton.click()

    await expect(selectionBanner).toHaveCount(0)
  })

  test('edits and resubmits the last prompt after stopping its turn', async ({
    agentPanel,
    postedMessages,
    getWebSocket
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const panel = agentPanel.root
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

    await expect(composer).toHaveText(originalPrompt)
    await expect(composer).toBeFocused()

    await composer.fill(revisedPrompt)
    await panel.getByRole('button', { name: enMessages.agent.send }).click()
    await expect.poll(() => postedMessages.length).toBe(2)
    expect(postedMessages[1]).toContain(revisedPrompt)
  })
})
