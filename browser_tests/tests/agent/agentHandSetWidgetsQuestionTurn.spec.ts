import { expect } from '@playwright/test'

import {
  HAND_SET,
  agentHandSetWidgetsTest as test,
  draftValues
} from '@e2e/fixtures/agentHandSetWidgetsFixture'

const REFUSALS_OUTLASTING_RETRY_BUDGET = 4

const annotation = [
  {
    type: 'issue',
    description: 'https://linear.app/comfyorg/issue/PM-2118'
  },
  {
    type: 'issue',
    description: 'https://linear.app/comfyorg/issue/FE-3601'
  }
]

test.describe(
  'Agent question-only turn after a dropped connection',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test(
      'keeps widgets set by hand before the connection drops',
      { annotation },
      async ({ handSetWidgets }) => {
        test.setTimeout(60_000)
        const { hostSocket } = handSetWidgets

        await test.step('The agent builds a KSampler and a Load Image', () =>
          handSetWidgets.agentBuildsNodes())

        await test.step('The user sets cfg and steps by hand', async () => {
          await handSetWidgets.setWidgetsByHand()
          await expect
            .poll(() => handSetWidgets.documentValues())
            .toEqual(HAND_SET)
        })

        await test.step('The agent connection drops and recovers', async () => {
          const connections = hostSocket.connectionCount()
          const subscribes = hostSocket.subscribeCount()
          await hostSocket.disconnect()
          await expect
            .poll(() => hostSocket.connectionCount(), { timeout: 30_000 })
            .toBeGreaterThan(connections)
          await expect
            .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
            .toBeGreaterThan(subscribes)
          await expect
            .poll(() => handSetWidgets.documentValues())
            .toEqual(HAND_SET)
        })

        await test.step('A question-only turn sends and keeps the hand-set values', async () => {
          const post = await handSetWidgets.askQuestion()
          expect(draftValues(post)).toEqual(HAND_SET)
          await handSetWidgets.finishQuestionTurn()
          await expect(handSetWidgets.questionMessage()).toBeVisible()
          await expect
            .poll(() => handSetWidgets.canvasValues())
            .toEqual(HAND_SET)
          await expect
            .poll(() => handSetWidgets.documentValues())
            .toEqual(HAND_SET)
        })
      }
    )

    test(
      'keeps widgets set by hand while the agent is offline',
      { annotation },
      async ({ handSetWidgets }) => {
        test.setTimeout(180_000)
        const { hostSocket } = handSetWidgets

        await test.step('The agent builds a KSampler and a Load Image', () =>
          handSetWidgets.agentBuildsNodes())

        const connections = hostSocket.connectionCount()
        const subscribes = hostSocket.subscribeCount()

        await test.step('The user sets cfg and steps by hand while offline', async () => {
          handSetWidgets.holdCatchUp()
          await hostSocket.beginAgentOutage()
          await handSetWidgets.setWidgetsByHand()
          await expect
            .poll(() => hostSocket.refusedConnectionCount(), {
              timeout: 90_000,
              message: 'the page keeps trying while the agent is down'
            })
            .toBeGreaterThanOrEqual(REFUSALS_OUTLASTING_RETRY_BUDGET)
          expect(hostSocket.connectionCount()).toBe(connections)
        })

        await test.step('The socket reconnects but the document has not caught up', async () => {
          hostSocket.endAgentOutage()
          await expect
            .poll(() => hostSocket.connectionCount(), { timeout: 30_000 })
            .toBeGreaterThan(connections)
        })

        await test.step('A question asked before catch-up sends no stale copy', async () => {
          const post = await handSetWidgets.askQuestion()
          expect(post.draft).toBeUndefined()
        })

        await test.step('Catch-up keeps the hand-set values', async () => {
          handSetWidgets.releaseCatchUp()
          await expect
            .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
            .toBeGreaterThan(subscribes)
          await handSetWidgets.finishQuestionTurn()
          await expect(handSetWidgets.questionMessage()).toBeVisible()
          await expect
            .poll(() => handSetWidgets.canvasValues())
            .toEqual(HAND_SET)
          await expect
            .poll(() => handSetWidgets.documentValues())
            .toEqual(HAND_SET)
        })
      }
    )
  }
)
