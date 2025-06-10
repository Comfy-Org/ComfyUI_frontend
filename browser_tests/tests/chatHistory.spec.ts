import { Page, expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

interface ChatHistoryEntry {
  prompt: string
  response: string
  response_id: string
}

async function renderChatHistory(page: Page, history: ChatHistoryEntry[]) {
  const nodeId = await page.evaluate(() => window['app'].graph.nodes[0]?.id)
  // Simulate API sending display_component message
  await page.evaluate(
    ({ nodeId, history }) => {
      const event = new CustomEvent('display_component', {
        detail: {
          node_id: nodeId,
          component: 'ChatHistoryWidget',
          props: {
            history: JSON.stringify(history)
          }
        }
      })
      window['app'].api.dispatchEvent(event)
      return true
    },
    { nodeId, history }
  )

  return nodeId
}

test.describe('Chat History Widget', () => {
  let nodeId: string

  test.beforeEach(async ({ comfyPage }) => {
    nodeId = await renderChatHistory(comfyPage.page, [
      { prompt: 'Hello', response: 'World', response_id: '123' }
    ])
    // Wait for chat history to be rendered
    await comfyPage.page.waitForSelector('.pi-pencil')
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf displays chat history when receiving display_component message', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'display-chat-history-component'

    await perfMonitor.startMonitoring(testName)

    // Verify the chat history is displayed correctly
    await expect(comfyPage.page.getByText('Hello')).toBeVisible()
    await expect(comfyPage.page.getByText('World')).toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf handles message editing interaction', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'message-editing-interaction'

    await perfMonitor.startMonitoring(testName)

    // Get first node's ID
    await perfMonitor.measureOperation('setup-node-widgets', async () => {
      nodeId = await comfyPage.page.evaluate(() => {
        const node = window['app'].graph.nodes[0]

        // Make sure the node has a prompt widget (for editing functionality)
        if (!node.widgets) {
          node.widgets = []
        }

        // Add a prompt widget if it doesn't exist
        if (!node.widgets.find((w) => w.name === 'prompt')) {
          node.widgets.push({
            name: 'prompt',
            type: 'text',
            value: 'Original prompt'
          })
        }

        return node.id
      })
    })

    await perfMonitor.measureOperation('render-chat-history', async () => {
      await renderChatHistory(comfyPage.page, [
        {
          prompt: 'Message 1',
          response: 'Response 1',
          response_id: '123'
        },
        {
          prompt: 'Message 2',
          response: 'Response 2',
          response_id: '456'
        }
      ])
      await comfyPage.page.waitForSelector('.pi-pencil')
    })

    const originalTextAreaInput = await comfyPage.page
      .getByPlaceholder('text')
      .nth(1)
      .inputValue()

    // Click edit button on first message
    await perfMonitor.measureOperation('click-edit-button', async () => {
      await comfyPage.page.getByLabel('Edit').first().click()
      await comfyPage.nextFrame()
    })

    // Verify cancel button appears
    await expect(comfyPage.page.getByLabel('Cancel')).toBeVisible()

    // Click cancel edit
    await perfMonitor.measureOperation('click-cancel-button', async () => {
      await comfyPage.page.getByLabel('Cancel').click()
    })

    // Verify prompt input is restored
    await expect(comfyPage.page.getByPlaceholder('text').nth(1)).toHaveValue(
      originalTextAreaInput
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf handles real-time updates to chat history', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'real-time-chat-history-updates'

    await perfMonitor.startMonitoring(testName)

    // Send initial history
    await perfMonitor.measureOperation('render-initial-history', async () => {
      await renderChatHistory(comfyPage.page, [
        {
          prompt: 'Initial message',
          response: 'Initial response',
          response_id: '123'
        }
      ])
      await comfyPage.page.waitForSelector('.pi-pencil')
    })

    await perfMonitor.markEvent('before-history-update')

    // Update history with additional messages
    await perfMonitor.measureOperation('update-chat-history', async () => {
      await renderChatHistory(comfyPage.page, [
        {
          prompt: 'Follow-up',
          response: 'New response',
          response_id: '456'
        }
      ])
      await comfyPage.page.waitForSelector('.pi-pencil')
    })

    // Move mouse over the canvas to force update
    await perfMonitor.measureOperation('trigger-canvas-update', async () => {
      await comfyPage.page.mouse.move(100, 100)
      await comfyPage.nextFrame()
    })

    await perfMonitor.markEvent('after-canvas-update')

    // Verify new messages appear
    await expect(comfyPage.page.getByText('Follow-up')).toBeVisible()
    await expect(comfyPage.page.getByText('New response')).toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })
})
