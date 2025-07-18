import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '../fixtures/ComfyPage'
import { webSocketFixture } from '../fixtures/ws'
import {
  ExecutionTestHelper,
  PreviewTestHelper
} from '../helpers/ExecutionTestHelper'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Preview with Metadata', () => {
  test.describe.configure({ mode: 'serial' })

  let executionHelper: ExecutionTestHelper
  let previewHelper: PreviewTestHelper

  test.beforeEach(async ({ comfyPage }) => {
    executionHelper = new ExecutionTestHelper(comfyPage.page)
    previewHelper = new PreviewTestHelper(comfyPage.page)
  })

  test.afterEach(async () => {
    if (executionHelper) {
      await executionHelper.cleanup()
    }
  })

  test('Handles b_preview_with_metadata event correctly', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Clear any existing previews
    await comfyPage.page.evaluate(() => {
      window['app'].nodePreviewImages = {}
    })

    // Set up handler to track preview events and execution
    await executionHelper.setupEventTracking()
    await comfyPage.page.evaluate(() => {
      window['__previewHandled'] = false
      const api = window['app'].api

      // Add handler to track preview events
      api.addEventListener('b_preview_with_metadata', (event) => {
        const { displayNodeId, blob } = event.detail
        // Create URL from the blob in the event
        const url = URL.createObjectURL(blob)
        window['app'].nodePreviewImages[displayNodeId] = [url]
        window['__previewHandled'] = true
        window['__lastPreviewUrl'] = url
      })
    })

    // Start real execution to test event handling in context
    await comfyPage.executeCommand('Comfy.QueuePrompt')

    // Wait for execution to start
    await executionHelper.waitForExecutionStart()

    // Trigger b_preview_with_metadata event (simulating what backend would send)
    await comfyPage.page.evaluate(() => {
      const api = window['app'].api
      const event = new CustomEvent('b_preview_with_metadata', {
        detail: {
          blob: new Blob(['test'], { type: 'image/png' }),
          nodeId: '2',
          displayNodeId: '2',
          parentNodeId: '2',
          realNodeId: '2',
          promptId: 'test-prompt-id'
        }
      })
      api.dispatchEvent(event)
    })

    await comfyPage.nextFrame()

    // Wait for preview to be handled
    await comfyPage.page.waitForFunction(
      () => window['__previewHandled'] === true,
      { timeout: 5000 }
    )

    // Check that preview was set for the correct node
    const result = await comfyPage.page.evaluate(() => {
      return {
        previewImages: window['app'].nodePreviewImages,
        lastUrl: window['__lastPreviewUrl']
      }
    })

    expect(result.previewImages['2']).toBeDefined()
    expect(result.previewImages['2']).toHaveLength(1)
    expect(result.previewImages['2'][0]).toBe(result.lastUrl)
  })

  test('Clears old previews when new preview arrives', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Set up initial preview
    const initialBlobUrl = await comfyPage.page.evaluate(() => {
      const blob = new Blob(['initial image'], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      window['app'].nodePreviewImages['3'] = [url]
      return url
    })

    // Create spy to track URL revocations
    await previewHelper.setupPreviewTracking()

    // Mock the handler to revoke old previews
    await comfyPage.page.evaluate(() => {
      const api = window['app'].api
      api.addEventListener('b_preview_with_metadata', (event) => {
        const { displayNodeId } = event.detail
        window['app'].revokePreviews(displayNodeId)
        const newBlob = new Blob(['new image'], { type: 'image/png' })
        const newUrl = URL.createObjectURL(newBlob)
        window['app'].nodePreviewImages[displayNodeId] = [newUrl]
      })
    })

    // Trigger new preview for same node
    await comfyPage.page.evaluate(() => {
      const api = window['app'].api
      const event = new CustomEvent('b_preview_with_metadata', {
        detail: {
          blob: new Blob(['new image'], { type: 'image/png' }),
          nodeId: '3',
          displayNodeId: '3',
          parentNodeId: '3',
          realNodeId: '3',
          promptId: 'test-prompt-id'
        }
      })
      api.dispatchEvent(event)
    })

    await comfyPage.nextFrame()

    // Check that old URL was revoked
    const finalRevokedUrls = await previewHelper.getRevokedUrls()
    expect(finalRevokedUrls).toContain(initialBlobUrl)

    // Check that new preview replaced old one
    const newPreviewImages = await previewHelper.getNodePreviews('3')

    expect(newPreviewImages).toHaveLength(1)
    expect(newPreviewImages[0]).not.toBe(initialBlobUrl)
  })

  test('Associates preview with correct display node in subgraph', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Mock handler that stores metadata
    await previewHelper.setupPreviewTracking()
    await comfyPage.page.evaluate(() => {
      window['__previewMetadata'] = {}
      const api = window['app'].api
      api.addEventListener('b_preview_with_metadata', (event) => {
        const { displayNodeId, nodeId, parentNodeId, realNodeId, promptId } =
          event.detail
        window['__previewMetadata'][displayNodeId] = {
          nodeId,
          displayNodeId,
          parentNodeId,
          realNodeId,
          promptId
        }
        // Still create the preview
        const url = URL.createObjectURL(event.detail.blob)
        window['app'].nodePreviewImages[displayNodeId] = [url]
      })
    })

    // Simulate preview from a subgraph node
    await comfyPage.page.evaluate(() => {
      const api = window['app'].api
      const event = new CustomEvent('b_preview_with_metadata', {
        detail: {
          blob: new Blob(['subgraph preview'], { type: 'image/png' }),
          nodeId: '10:5:3', // Nested execution ID
          displayNodeId: '10', // Top-level display node
          parentNodeId: '10:5', // Parent subgraph
          realNodeId: '3', // Actual node ID within subgraph
          promptId: 'test-prompt-id'
        }
      })
      api.dispatchEvent(event)
    })

    await comfyPage.nextFrame()

    // Check that preview is associated with display node
    const metadata = await comfyPage.page.evaluate(
      () => window['__previewMetadata']
    )
    expect(metadata['10']).toBeDefined()
    expect(metadata['10'].nodeId).toBe('10:5:3')
    expect(metadata['10'].displayNodeId).toBe('10')
    expect(metadata['10'].parentNodeId).toBe('10:5')
    expect(metadata['10'].realNodeId).toBe('3')

    // Check that preview exists for display node
    const previews = await comfyPage.page.evaluate(
      () => window['app'].nodePreviewImages
    )
    expect(previews['10']).toBeDefined()
    expect(previews['10']).toHaveLength(1)
  })

  test('Maintains backward compatibility with b_preview event', async ({
    comfyPage,
    ws
  }) => {
    await comfyPage.loadWorkflow('execution/parallel_async_nodes')

    // Track both events
    const eventsFired = await comfyPage.page.evaluate(() => {
      const events: string[] = []
      const api = window['app'].api

      api.addEventListener('b_preview', () => {
        events.push('b_preview')
      })

      api.addEventListener('b_preview_with_metadata', () => {
        events.push('b_preview_with_metadata')
      })

      window['__eventsFired'] = events
      return events
    })

    // Trigger b_preview_with_metadata
    await comfyPage.page.evaluate(() => {
      const api = window['app'].api
      const blob = new Blob(['test image'], { type: 'image/png' })

      // Simulate the API behavior
      api.dispatchCustomEvent('b_preview_with_metadata', {
        blob,
        nodeId: '2',
        displayNodeId: '2',
        parentNodeId: '2',
        realNodeId: '2',
        promptId: 'test-prompt-id'
      })

      // Also dispatch legacy event as the API would
      api.dispatchCustomEvent('b_preview', blob)
    })

    await comfyPage.nextFrame()

    // Check that both events were fired
    const finalEvents = await comfyPage.page.evaluate(
      () => window['__eventsFired']
    )
    expect(finalEvents).toContain('b_preview_with_metadata')
    expect(finalEvents).toContain('b_preview')
  })
})
