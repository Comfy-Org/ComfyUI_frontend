import type { AgentMessage } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentThreadPage,
  agentThreadSummary,
  agentUserTranscript,
  emptyAgentThreadList
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  agentTest as baseAgentTest,
  pushAgentEvent,
  WORKFLOW_ID
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(baseAgentTest, webSocketFixture)

test.describe(
  'Agent optimistic and chat-owned sends',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('O0-01: shows the sent message with a spinner before the POST settles and clears it on accept', async ({
      agentPanel,
      page
    }) => {
      let releasePost: () => void = () => {}
      const postPending = new Promise<void>((resolve) => {
        releasePost = resolve
      })
      let markPostEntered: () => void = () => {}
      const postEntered = new Promise<void>((resolve) => {
        markPostEntered = resolve
      })
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        markPostEntered()
        await postPending
        return route.fallback()
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Optimistic message')
      await agentPanel.sendButton.click()

      await expect(agentPanel.composer).toHaveText('')
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'Optimistic message'
      ])
      await expect(agentPanel.sendingSpinner).toBeVisible()
      await expect(agentPanel.stopButton).toBeVisible()

      await postEntered
      releasePost()

      await expect(agentPanel.sendingSpinner).toHaveCount(0)
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'Optimistic message'
      ])
    })

    test('O0-07: continues a pending send into the background on New chat and resumes on return', async ({
      agentPanel,
      getAgentSocket,
      page
    }) => {
      const prompt = 'Background prompt'
      const createdThreadId = 'th-o0-07'
      const createdTurnId = 'msg-o0-07'
      let createdOnServer = false
      let releasePost: () => void = () => {}
      const postPending = new Promise<void>((resolve) => {
        releasePost = resolve
      })
      let markPostEntered: () => void = () => {}
      const postEntered = new Promise<void>((resolve) => {
        markPostEntered = resolve
      })

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(
          jsonRoute(
            createdOnServer
              ? agentThreadPage([
                  agentThreadSummary(createdThreadId, prompt, {
                    workflow_id: WORKFLOW_ID
                  })
                ])
              : emptyAgentThreadList()
          )
        )
      )
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        const request = route.request()
        if (request.method() === 'POST') {
          markPostEntered()
          await postPending
          const accepted: AgentTurnAccepted = {
            thread_id: createdThreadId,
            message_id: createdTurnId,
            workflow_id: WORKFLOW_ID
          }
          return route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify(accepted)
          })
        }
        if (request.url().includes(`/threads/${createdThreadId}/messages`)) {
          const rows: AgentMessage[] = [
            {
              ...agentUserTranscript(createdThreadId, WORKFLOW_ID, prompt)[0],
              turn_id: createdTurnId
            },
            {
              id: createdTurnId,
              thread_id: createdThreadId,
              turn_id: createdTurnId,
              seq: 2,
              role: 'assistant',
              status: 'streaming',
              workflow_id: WORKFLOW_ID,
              content: {}
            }
          ]
          return route.fulfill(jsonRoute(rows))
        }
        return route.fallback()
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill(prompt)
      await agentPanel.sendButton.click()
      await postEntered

      await expect(agentPanel.sendingSpinner).toBeVisible()
      await agentPanel.newChatButton.click()

      await expect(agentPanel.userMessageBubbles).toHaveCount(0)
      await expect(agentPanel.sendingSpinner).toHaveCount(0)
      await expect(agentPanel.sendButton).toBeVisible()

      createdOnServer = true
      const postAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/agent\/threads\/[^/]+\/messages$/.test(response.url())
      )
      releasePost()
      await postAccepted

      await expect(agentPanel.userMessageBubbles).toHaveCount(0)
      const deltaEvent: AgentWsEvent = {
        type: 'agent_message_delta',
        data: {
          delta: 'Background reply',
          message_id: createdTurnId,
          thread_id: createdThreadId
        }
      }
      const doneEvent: AgentWsEvent = {
        type: 'agent_message_done',
        data: {
          message_id: createdTurnId,
          thread_id: createdThreadId
        }
      }
      pushAgentEvent(await getAgentSocket(), deltaEvent)
      pushAgentEvent(await getAgentSocket(), doneEvent)

      await agentPanel.openChatFromHistory(prompt)
      await expect(agentPanel.userMessageBubbles).toHaveText([prompt])
      await expect(agentPanel.root.getByText('Background reply')).toBeVisible()
    })

    test('O0-04: network failure stays in place, Delete removes it, and Retry sends once', async ({
      agentPanel,
      page,
      postedMessages
    }) => {
      let failPosts = true
      const attemptedClientIds: string[] = []
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        const request = route.request()
        if (request.method() !== 'POST') return route.fallback()
        const body = zAgentPostMessageRequest.parse(request.postDataJSON())
        if (body.client_message_id)
          attemptedClientIds.push(body.client_message_id)
        if (failPosts) return route.abort('failed')
        return route.fallback()
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await agentPanel.sendMessage('First failed')
      await expect(agentPanel.pendingSendError).toHaveText(
        enMessages.agent.sendFailedNetwork
      )
      await expect(agentPanel.composer).toHaveText('')
      await expect(agentPanel.retryPendingButton).toBeEnabled()
      await expect(agentPanel.deletePendingButton).toBeEnabled()

      await agentPanel.sendMessage('Second failed')
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'First failed',
        'Second failed'
      ])
      await expect(agentPanel.deletePendingButton).toHaveCount(2)

      await agentPanel.deletePendingButton.nth(1).click()
      await expect(agentPanel.userMessageBubbles).toHaveText(['First failed'])
      await expect(agentPanel.deletePendingButton).toHaveCount(1)

      failPosts = false
      await agentPanel.retryPendingButton.click()

      await expect.poll(() => postedMessages).toHaveLength(1)
      expect(
        zAgentPostMessageRequest.parse(JSON.parse(postedMessages[0]))
      ).toMatchObject({ content: 'First failed' })
      expect(attemptedClientIds).toHaveLength(3)
      expect(attemptedClientIds[2]).not.toBe(attemptedClientIds[0])
      await expect(agentPanel.pendingSendError).toHaveCount(0)
      await expect(agentPanel.userMessageBubbles).toHaveText(['First failed'])
    })

    test('O0-09: allows concurrent sends across two chats with per-chat Stop state', async ({
      agentPanel,
      page,
      postedMessages
    }) => {
      const existingThreadId = 'th-existing'
      const resolvers: Array<() => void> = []
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(
          jsonRoute(
            agentThreadPage([
              agentThreadSummary(existingThreadId, 'Existing chat')
            ])
          )
        )
      )
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        const request = route.request()
        if (request.method() === 'POST') {
          await new Promise<void>((resolve) => {
            resolvers.push(resolve)
          })
          if (request.url().includes(`/threads/${existingThreadId}/messages`)) {
            const accepted: AgentTurnAccepted = {
              thread_id: existingThreadId,
              message_id: 'msg-existing-2',
              workflow_id: WORKFLOW_ID
            }
            return route.fulfill({
              status: 202,
              contentType: 'application/json',
              body: JSON.stringify(accepted)
            })
          }
          return route.fallback()
        }
        if (request.url().includes(`/threads/${existingThreadId}/messages`)) {
          return route.fulfill(
            jsonRoute(
              agentUserTranscript(
                existingThreadId,
                WORKFLOW_ID,
                'Existing prompt'
              )
            )
          )
        }
        return route.fallback()
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await agentPanel.sendMessage('Chat one pending')
      await expect.poll(() => resolvers).toHaveLength(1)
      await expect(agentPanel.stopButton).toBeVisible()

      await agentPanel.openChatFromHistory('Existing chat')
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'Existing prompt'
      ])
      await expect(agentPanel.stopButton).toHaveCount(0)
      await expect(agentPanel.sendButton).toBeVisible()

      await agentPanel.sendMessage('Chat two pending')
      await expect.poll(() => resolvers).toHaveLength(2)
      await expect(agentPanel.stopButton).toBeVisible()
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'Existing prompt',
        'Chat two pending'
      ])

      const chatOneAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/agent/threads/new/messages')
      )
      const chatTwoAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/threads/${existingThreadId}/messages`)
      )
      resolvers[0]()
      resolvers[1]()
      await Promise.all([chatOneAccepted, chatTwoAccepted])
      await expect.poll(() => postedMessages).toHaveLength(1)
    })

    test('O0-13 + O0-14: offers Show toast when a first message fails off screen and reopens it with Retry', async ({
      agentPanel,
      page,
      postedMessages
    }) => {
      let rejectPost: (() => void) | undefined
      let failNextPost = true
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        if (failNextPost) {
          await new Promise<void>((resolve) => {
            rejectPost = resolve
          })
          return route.abort('failed')
        }
        return route.fallback()
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await agentPanel.sendMessage('Offscreen first message')
      await expect.poll(() => rejectPost).toBeDefined()

      await agentPanel.newChatButton.click()
      await expect(agentPanel.userMessageBubbles).toHaveCount(0)
      await agentPanel.composer.fill('Draft in second chat')

      failNextPost = false
      rejectPost?.()

      const toast = page
        .getByTestId('toast')
        .filter({ hasText: enMessages.agent.sendFailedOffscreen })
      await expect(toast).toBeVisible()
      await expect(agentPanel.composer).toHaveText('Draft in second chat')
      await expect(agentPanel.userMessageBubbles).toHaveCount(0)

      await toast
        .getByRole('button', {
          name: enMessages.agent.sendFailedOffscreenShow,
          exact: true
        })
        .click()

      await expect(toast).toHaveCount(0)
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'Offscreen first message'
      ])
      await expect(agentPanel.pendingSendError).toContainText(
        enMessages.agent.sendFailedNetwork
      )
      await expect(agentPanel.retryPendingButton).toBeEnabled()

      await agentPanel.retryPendingButton.click()
      await expect.poll(() => postedMessages).toHaveLength(1)
      await expect(agentPanel.pendingSendError).toHaveCount(0)
      await expect(agentPanel.userMessageBubbles).toHaveText([
        'Offscreen first message'
      ])
    })
  }
)
