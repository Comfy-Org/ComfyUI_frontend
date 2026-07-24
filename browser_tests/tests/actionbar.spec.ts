import type { Response } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import type { PromptResponse } from '@/schemas/apiSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { WorkspaceStore } from '@e2e/types/globals'

const webSocketTest = mergeTests(test, webSocketFixture)

webSocketTest.describe(
  'Actionbar auto-queue single-flight',
  { tag: '@ui' },
  () => {
    /**
     * This test ensures that the autoqueue change mode can only queue one change at a time
     */
    webSocketTest(
      'Does not auto-queue multiple changes at a time',
      async ({ comfyPage, getWebSocket }) => {
        await comfyPage.workflow.loadWorkflow('default')

        const ws = await getWebSocket()

        // Enable change auto-queue mode
        const queueOpts = await comfyPage.actionbar.queueButton.toggleOptions()
        await expect.poll(() => queueOpts.getMode()).toBe('disabled')
        await queueOpts.setMode('change')
        await comfyPage.nextFrame()
        await expect.poll(() => queueOpts.getMode()).toBe('change')
        await comfyPage.actionbar.queueButton.toggleOptions()

        // Intercept the prompt queue endpoint
        let promptNumber = 0
        await comfyPage.page.route('**/api/prompt', async (route, req) => {
          await new Promise((r) => setTimeout(r, 100))
          await route.fulfill({
            status: 200,
            body: JSON.stringify({
              prompt_id: promptNumber,
              number: ++promptNumber,
              node_errors: {},
              // Include the request data to validate which prompt was queued so we can validate the width
              __request: req.postDataJSON()
            })
          })
        })

        // Start watching for a message to prompt
        const requestPromise = comfyPage.page.waitForResponse('**/api/prompt')

        // Find and set the width on the latent node
        const triggerChange = async (value: number) => {
          return await comfyPage.page.evaluate((value) => {
            const node = window.app!.graph!._nodes.find(
              (n) => n.type === 'EmptyLatentImage'
            )
            node!.widgets![0].value = value

            ;(
              window.app!.extensionManager as WorkspaceStore
            ).workflow.activeWorkflow?.changeTracker.captureCanvasState()
          }, value)
        }

        // Trigger a status websocket message
        const triggerStatus = (queueSize: number) => {
          ws.send(
            JSON.stringify({
              type: 'status',
              data: {
                status: {
                  exec_info: {
                    queue_remaining: queueSize
                  }
                }
              }
            })
          )
        }

        // Extract the width from the queue response
        const getQueuedWidth = async (resp: Promise<Response>) => {
          const obj = await (await resp).json()
          return obj['__request']['prompt']['5']['inputs']['width']
        }

        // Trigger a bunch of changes
        const START = 32
        const END = 64
        for (let i = START; i <= END; i += 8) {
          await triggerChange(i)
        }

        // Ensure the queued width is the first value
        expect(
          await getQueuedWidth(requestPromise),
          'the first queued prompt should be the first change width'
        ).toBe(START)

        // Ensure that no other changes are queued
        await expect(
          comfyPage.page.waitForResponse('**/api/prompt', { timeout: 250 })
        ).rejects.toThrow()
        expect(
          promptNumber,
          'only 1 prompt should have been queued even though there were multiple changes'
        ).toBe(1)

        // Trigger a status update so auto-queue re-runs
        triggerStatus(1)
        triggerStatus(0)

        // Ensure the queued width is the last queued value
        expect(
          await getQueuedWidth(comfyPage.page.waitForResponse('**/api/prompt')),
          'last queued prompt width should be the last change'
        ).toBe(END)
        expect(promptNumber, 'queued prompt count should be 2').toBe(2)
      }
    )
  }
)

test.describe('Actionbar', { tag: '@ui' }, () => {
  test.describe('Run on change', { tag: ['@canvas', '@widget'] }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')

      const promptResponse: PromptResponse = {
        prompt_id: 'run-on-change',
        node_errors: {},
        error: ''
      }
      await comfyPage.page.route('**/api/prompt', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(promptResponse)
        })
      })

      const queueOpts = await comfyPage.actionbar.queueButton.toggleOptions()
      await queueOpts.setMode('change')
      await expect.poll(() => queueOpts.getMode()).toBe('change')
      await comfyPage.actionbar.queueButton.toggleOptions()
    })

    test('Auto-queues after changing a widget', async ({ comfyPage }) => {
      const promptRequests =
        await comfyPage.actionbar.collectPromptRequestsDuring(async () => {
          await comfyPage.nodeOps.adjustEmptyLatentWidth()
        })

      expect(
        promptRequests,
        'changing a widget should submit one prompt in change mode'
      ).toHaveLength(1)
      expect(promptRequests[0].postDataJSON().prompt['5'].inputs.width).toBe(
        128
      )
    })

    test('Does not auto-queue when resizing a node', async ({ comfyPage }) => {
      const latentNodes =
        await comfyPage.nodeOps.getNodeRefsByType('EmptyLatentImage')
      expect(
        latentNodes,
        'the default workflow should contain an EmptyLatentImage node'
      ).toHaveLength(1)
      const latentNode = latentNodes[0]
      const originalPosition = await latentNode.getPosition()
      const originalSize = await latentNode.getSize()

      async function resizeLatentNode() {
        await comfyPage.nodeOps.resizeNode(
          originalPosition,
          originalSize,
          1.2,
          1.2
        )
      }
      const promptRequests =
        await comfyPage.actionbar.collectPromptRequestsDuring(resizeLatentNode)

      expect(
        await latentNode.getSize(),
        'the resize gesture should change the serialized node size'
      ).not.toEqual(originalSize)

      expect(
        promptRequests,
        'resizing a node should not submit a prompt in change mode'
      ).toHaveLength(0)
    })
  })

  test('Can dock actionbar into top menu', async ({ comfyPage }) => {
    await comfyPage.page.dragAndDrop(
      '.actionbar .drag-handle',
      '.actionbar-container',
      {
        targetPosition: { x: 50, y: 20 },
        force: true
      }
    )
    await expect(comfyPage.actionbar.root.locator('.actionbar')).toHaveClass(
      /static/
    )
  })
})
