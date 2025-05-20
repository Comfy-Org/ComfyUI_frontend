import { Page, expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

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

  test('displays chat history when receiving display_component message', async ({
    comfyPage
  }) => {
    // Verify the chat history is displayed correctly
    await expect(comfyPage.page.getByText('Hello')).toBeVisible()
    await expect(comfyPage.page.getByText('World')).toBeVisible()
  })

  test('handles message editing interaction', async ({ comfyPage }) => {
    // Get first node's ID
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

    const originalTextAreaInput = await comfyPage.page
      .getByPlaceholder('text')
      .nth(1)
      .inputValue()

    // Click edit button on first message
    await comfyPage.page.getByLabel('Edit').first().click()
    await comfyPage.nextFrame()

    // Verify cancel button appears
    await expect(comfyPage.page.getByLabel('Cancel')).toBeVisible()

    // Click cancel edit
    await comfyPage.page.getByLabel('Cancel').click()

    // Verify prompt input is restored
    await expect(comfyPage.page.getByPlaceholder('text').nth(1)).toHaveValue(
      originalTextAreaInput
    )
  })

  test('handles real-time updates to chat history', async ({ comfyPage }) => {
    // Send initial history
    await renderChatHistory(comfyPage.page, [
      {
        prompt: 'Initial message',
        response: 'Initial response',
        response_id: '123'
      }
    ])
    await comfyPage.page.waitForSelector('.pi-pencil')

    // Update history with additional messages
    await renderChatHistory(comfyPage.page, [
      {
        prompt: 'Follow-up',
        response: 'New response',
        response_id: '456'
      }
    ])
    await comfyPage.page.waitForSelector('.pi-pencil')

    // Move mouse over the canvas to force update
    await comfyPage.page.mouse.move(100, 100)
    await comfyPage.nextFrame()

    // Verify new messages appear
    await expect(comfyPage.page.getByText('Follow-up')).toBeVisible()
    await expect(comfyPage.page.getByText('New response')).toBeVisible()
  })
})
