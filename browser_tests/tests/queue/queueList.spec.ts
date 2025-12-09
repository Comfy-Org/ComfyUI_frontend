import { expect, mergeTests } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import type { StatusWsMessage } from '../../../src/schemas/apiSchema.ts'
import { comfyPageFixture } from '../../fixtures/ComfyPage'
import { webSocketFixture } from '../../fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

type QueueState = {
  running: QueueJob[]
  pending: QueueJob[]
}

type QueueJob = [
  string,
  string,
  Record<string, unknown>,
  Record<string, unknown>,
  string[]
]

type QueueController = {
  state: QueueState
  sync: (
    ws: { trigger(data: any, url?: string): Promise<void> },
    nextState: Partial<QueueState>
  ) => Promise<void>
}

test.describe('Queue UI', () => {
  let queue: QueueController

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route('**/api/prompt', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prompt_id: 'mock-prompt-id',
          number: 1,
          node_errors: {}
        })
      })
    })

    // Mock history to avoid pulling real data
    await comfyPage.page.route('**/api/history**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ History: [] })
      })
    })

    queue = await createQueueController(comfyPage)
  })

  test('toggles overlay and updates count from status events', async ({
    comfyPage,
    ws
  }) => {
    await queue.sync(ws, { running: [], pending: [] })

    await expect(comfyPage.queueList.toggleButton).toContainText('0')
    await expect(comfyPage.queueList.toggleButton).toContainText(/queued/i)
    await expect(comfyPage.queueList.overlay).toBeHidden()

    await queue.sync(ws, {
      pending: [queueJob('1', 'mock-pending', 'client-a')]
    })

    await expect(comfyPage.queueList.toggleButton).toContainText('1')
    await expect(comfyPage.queueList.toggleButton).toContainText(/queued/i)

    await comfyPage.queueList.open()
    await expect(comfyPage.queueList.overlay).toBeVisible()
    await expect(comfyPage.queueList.jobItems).toHaveCount(1)

    await comfyPage.queueList.close()
    await expect(comfyPage.queueList.overlay).toBeHidden()
  })

  test('displays running and pending jobs via status updates', async ({
    comfyPage,
    ws
  }) => {
    await queue.sync(ws, {
      running: [queueJob('2', 'mock-running', 'client-b')],
      pending: [queueJob('3', 'mock-pending', 'client-c')]
    })

    await comfyPage.queueList.open()
    await expect(comfyPage.queueList.jobItems).toHaveCount(2)

    const firstJob = comfyPage.queueList.jobItems.first()
    await firstJob.hover()

    const cancelAction = firstJob
      .getByTestId('job-action-cancel-running')
      .or(firstJob.getByTestId('job-action-cancel-hover'))

    await expect(cancelAction).toBeVisible()
  })
})

const queueJob = (
  queueIndex: string,
  promptId: string,
  clientId: string
): QueueJob => [
  queueIndex,
  promptId,
  { client_id: clientId },
  { class_type: 'Note' },
  ['output']
]

const createQueueController = async (
  comfyPage: ComfyPage
): Promise<QueueController> => {
  const state: QueueState = { running: [], pending: [] }

  // Single queue handler reads the latest in-memory state
  await comfyPage.page.route('**/api/queue', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        queue_running: state.running,
        queue_pending: state.pending
      })
    })
  })

  const sync = async (
    ws: { trigger(data: any, url?: string): Promise<void> },
    nextState: Partial<QueueState>
  ) => {
    if (nextState.running) state.running = nextState.running
    if (nextState.pending) state.pending = nextState.pending

    const total = state.running.length + state.pending.length
    const queueResponse = comfyPage.page.waitForResponse('**/api/queue')

    await ws.trigger({
      type: 'status',
      data: {
        status: { exec_info: { queue_remaining: total } }
      }
    } as StatusWsMessage)

    await queueResponse
  }

  return { state, sync }
}
