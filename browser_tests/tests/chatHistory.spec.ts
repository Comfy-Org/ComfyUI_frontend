import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Chat History Widget', () => {
  test('displays chat history when receiving display_component message', async ({ comfyPage }) => {
    // Load default workflow to get a node to work with
    await comfyPage.setup()
    
    // Get first node's ID from the graph
    const nodeId = await comfyPage.page.evaluate(() => {
      return window['app'].graph.nodes[0]?.id
    })
    
    // Make sure we have a node
    expect(nodeId).toBeDefined()
    
    // Simulate API sending display_component message
    await comfyPage.page.evaluate((nodeId) => {
      const event = new CustomEvent('display_component', {
        detail: {
          node_id: nodeId,
          component: 'ChatHistoryWidget',
          props: {
            history: JSON.stringify([
              { prompt: 'Hello', response: 'World', response_id: '123' }
            ])
          }
        }
      })
      window['app'].api.dispatchEvent(event)
    }, nodeId)
    
    // Wait for chat history to be rendered
    await comfyPage.page.waitForSelector('.pi-pencil')
    
    // Take screenshot to verify visual appearance
    await expect(comfyPage.canvas).toHaveScreenshot('chat-history-widget.png')
    
    // Test copy functionality
    const copyButton = comfyPage.page.locator('.pi-copy').first()
    await copyButton.click()
    
    // Verify tooltip displayed "Copied"
    await expect(comfyPage.page.getByText('Copied')).toBeVisible()
  })
  
  test('handles message editing interaction', async ({ comfyPage }) => {
    await comfyPage.setup()
    
    // Get first node's ID
    const nodeId = await comfyPage.page.evaluate(() => {
      const node = window['app'].graph.nodes[0]
      
      // Make sure the node has a prompt widget (for editing functionality)
      if (!node.widgets) {
        node.widgets = []
      }
      
      // Add a prompt widget if it doesn't exist
      if (!node.widgets.find(w => w.name === 'prompt')) {
        node.widgets.push({
          name: 'prompt', 
          type: 'text',
          value: 'Original prompt'
        })
      }
      
      return node.id
    })
    
    // Send display_component message with chat history
    await comfyPage.page.evaluate((nodeId) => {
      const event = new CustomEvent('display_component', {
        detail: {
          node_id: nodeId,
          component: 'ChatHistoryWidget',
          props: {
            history: JSON.stringify([
              { prompt: 'Message 1', response: 'Response 1', response_id: '123' },
              { prompt: 'Message 2', response: 'Response 2', response_id: '456' }
            ])
          }
        }
      })
      window['app'].api.dispatchEvent(event)
    }, nodeId)
    
    // Wait for rendering
    await comfyPage.page.waitForSelector('.pi-pencil')
    
    // Click edit button on first message
    const editButtons = await comfyPage.page.locator('.pi-pencil').all()
    await editButtons[0].click()
    
    // Verify cancel button appears
    await expect(comfyPage.page.locator('.pi-times')).toBeVisible()
    
    // Verify older messages are dimmed
    await expect(comfyPage.page.locator('.opacity-25')).toBeVisible()
    await expect(comfyPage.page.locator('.opacity-40')).toBeVisible()
    
    // Click cancel edit
    await comfyPage.page.locator('.pi-times').click()
    
    // Verify cancel button disappears
    await expect(comfyPage.page.locator('.pi-times')).toBeHidden()
    
    // Take screenshot of final state
    await expect(comfyPage.canvas).toHaveScreenshot('chat-history-editing.png')
  })
  
  test('handles real-time updates to chat history', async ({ comfyPage }) => {
    await comfyPage.setup()
    
    // Get first node's ID
    const nodeId = await comfyPage.page.evaluate(() => {
      return window['app'].graph.nodes[0]?.id
    })
    
    // Send initial history
    await comfyPage.page.evaluate((nodeId) => {
      const event = new CustomEvent('display_component', {
        detail: {
          node_id: nodeId,
          component: 'ChatHistoryWidget',
          props: {
            history: JSON.stringify([
              { prompt: 'Initial message', response: 'Initial response', response_id: '123' }
            ])
          }
        }
      })
      window['app'].api.dispatchEvent(event)
    }, nodeId)
    
    // Wait for initial rendering
    await comfyPage.page.waitForSelector('.pi-pencil')
    
    // Take screenshot of initial state
    await expect(comfyPage.canvas).toHaveScreenshot('chat-history-initial.png')
    
    // Update history with additional messages
    await comfyPage.page.evaluate((nodeId) => {
      const event = new CustomEvent('display_component', {
        detail: {
          node_id: nodeId,
          component: 'ChatHistoryWidget',
          props: {
            history: JSON.stringify([
              { prompt: 'Initial message', response: 'Initial response', response_id: '123' },
              { prompt: 'Follow-up', response: 'New response', response_id: '456' }
            ])
          }
        }
      })
      window['app'].api.dispatchEvent(event)
    }, nodeId)
    
    // Verify new messages appear
    await expect(comfyPage.page.getByText('Follow-up')).toBeVisible()
    await expect(comfyPage.page.getByText('New response')).toBeVisible()
    
    // Take screenshot of updated state
    await expect(comfyPage.canvas).toHaveScreenshot('chat-history-updated.png')
  })
})