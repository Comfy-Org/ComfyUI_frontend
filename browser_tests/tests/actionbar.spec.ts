import type { Request } from '@playwright/test'
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
        await comfyPage.page.evaluate(() => {
          const sampler = window.app!.graph!._nodes.find(
            (node) => node.type === 'KSampler'
          )
          const control = sampler?.widgets?.find(
            (widget) => widget.name === 'control_after_generate'
          )
          if (!control) throw new Error('seed control widget missing')
          control.value = 'fixed'
          ;(
            window.app!.extensionManager as WorkspaceStore
          ).workflow.activeWorkflow?.changeTracker.captureCanvasState()
        })

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
        await comfyPage.page.route('**/api/prompt', async (route) => {
          await new Promise((r) => setTimeout(r, 100))
          promptNumber++
          const promptResponse: PromptResponse = {
            prompt_id: String(promptNumber),
            node_errors: {},
            error: ''
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(promptResponse)
          })
        })

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

        const getQueuedWidth = (request: Request) => {
          return request.postDataJSON().prompt['5'].inputs.width
        }

        // Trigger a bunch of changes
        const START = 32
        const END = 64
        const initialPromptRequests =
          await comfyPage.actionbar.collectPromptRequestsDuring(async () => {
            for (let i = START; i <= END; i += 8) {
              await triggerChange(i)
            }
          }, 2000)

        expect(
          initialPromptRequests,
          'only 1 prompt should have been queued even though there were multiple changes'
        ).toHaveLength(1)
        expect(
          getQueuedWidth(initialPromptRequests[0]),
          'the first queued prompt should be the first change width'
        ).toBe(START)
        expect(promptNumber, 'the prompt endpoint should be called once').toBe(
          1
        )

        // Trigger a status update so auto-queue re-runs
        const deferredPromptRequests =
          await comfyPage.actionbar.collectPromptRequestsDuring(async () => {
            triggerStatus(1)
            triggerStatus(0)
          }, 2000)

        // Ensure the queued width is the last queued value
        expect(
          deferredPromptRequests,
          'the deferred changes should coalesce into one prompt'
        ).toHaveLength(1)
        expect(
          getQueuedWidth(deferredPromptRequests[0]),
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
