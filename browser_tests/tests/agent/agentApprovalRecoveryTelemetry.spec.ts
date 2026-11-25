import { expect, mergeTests } from '@playwright/test'

import {
  APPROVAL_RUN_OPTION_ID,
  RUN_APPROVAL_EVENT,
  agentTurnLockTest
} from '@e2e/fixtures/agentTurnLockFixture'
import {
  capturedProperties,
  hostTelemetryFixture
} from '@e2e/fixtures/hostTelemetryFixture'
import { TestIds } from '@e2e/fixtures/selectors'

const test = mergeTests(agentTurnLockTest, hostTelemetryFixture)

const SHOWN = 'app:agent_run_approval_shown'
const RESOLVED = 'app:agent_run_approval_resolved'
const ANSWER_FAILED = 'app:agent_run_approval_answer_failed'
const RECOVERY_ATTEMPTED = 'app:agent_run_approval_recovery_attempted'
const RECOVERY_OUTCOME = 'app:agent_run_approval_recovery_outcome'

test.describe.configure({ timeout: 180_000 })
test.use({
  connectWebSocketToServer: false,
  turnLockFeatures: { enable_telemetry: true }
})

function soleAskId(properties: Record<string, unknown>[]): string | undefined {
  const askIds = new Set(properties.map(({ ask_id }) => ask_id))
  if (askIds.size !== 1) return undefined
  const [askId] = askIds
  return typeof askId === 'string' && askId.length > 0 ? askId : undefined
}

test.describe(
  'approval recovery telemetry correlates by ask_id',
  { tag: ['@cloud', '@agent'] },
  () => {
    const PROMPT = 'build an img2img workflow and then turn it into img2video'

    test.beforeEach(async ({ turnLock }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(PROMPT)
    })

    test('a dropped approval frame reports one attempt, a restored outcome, and answers under the same ask_id', async ({
      turnLock,
      hostTelemetry
    }) => {
      turnLock.parkOnApproval()
      await expect(turnLock.approvalCard).toHaveCount(0)
      const reconnected = await turnLock.dropSocket()

      await expect(turnLock.approvalCard).toBeVisible({ timeout: 60_000 })

      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED), {
          timeout: 30_000
        })
        .toMatchObject([{ cause: 'reconnect' }])
      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_OUTCOME), {
          timeout: 30_000
        })
        .toMatchObject([{ cause: 'reconnect', outcome: 'restored' }])

      await turnLock.runApprovalButton.click()
      await expect
        .poll(() => turnLock.answeredAsks())
        .toEqual([APPROVAL_RUN_OPTION_ID])
      turnLock.resolveApproval(reconnected)
      await expect(turnLock.approvalCard).toHaveCount(0)

      await expect
        .poll(() => capturedProperties(hostTelemetry, RESOLVED), {
          timeout: 30_000
        })
        .toMatchObject([{ decision: 'run' }])

      const correlated = [
        ...capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED),
        ...capturedProperties(hostTelemetry, RECOVERY_OUTCOME),
        ...capturedProperties(hostTelemetry, SHOWN),
        ...capturedProperties(hostTelemetry, RESOLVED)
      ]
      expect(correlated).toHaveLength(4)
      expect(soleAskId(correlated)).toBeDefined()

      expect(new Set(correlated.map(({ turn_id }) => turn_id)).size).toBe(1)
    })

    test('a broadcast that merely lagged the poll reports a superseded outcome, not a restored one', async ({
      turnLock,
      hostTelemetry
    }) => {
      turnLock.parkOnApproval()
      const reconnected = await turnLock.dropSocket()

      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED), {
          timeout: 60_000,
          intervals: [50]
        })
        .toMatchObject([{ cause: 'reconnect' }])

      turnLock.push(reconnected, RUN_APPROVAL_EVENT)

      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_OUTCOME), {
          timeout: 30_000
        })
        .toMatchObject([{ cause: 'reconnect', outcome: 'superseded' }])

      await expect(turnLock.approvalCard).toHaveCount(1)

      const correlated = [
        ...capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED),
        ...capturedProperties(hostTelemetry, RECOVERY_OUTCOME),
        ...capturedProperties(hostTelemetry, SHOWN)
      ]
      expect(correlated).toHaveLength(3)
      expect(soleAskId(correlated)).toBeDefined()
    })

    test('an approval the socket delivered reports no recovery at all', async ({
      turnLock,
      hostTelemetry,
      page
    }) => {
      turnLock.parkOnApproval()
      turnLock.push(await turnLock.liveSocket(), RUN_APPROVAL_EVENT)
      await expect(turnLock.approvalCard).toBeVisible()

      await expect
        .poll(() => capturedProperties(hostTelemetry, SHOWN), {
          timeout: 30_000
        })
        .toHaveLength(1)

      let recoveryResponses = 0
      const thirdRecoveryResponse = page.waitForResponse((response) => {
        const request = response.request()
        if (
          request.method() !== 'GET' ||
          !new URL(response.url()).pathname.endsWith('/messages')
        )
          return false
        return ++recoveryResponses === 3
      })

      await turnLock.dropSocket()
      await thirdRecoveryResponse
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      )

      expect(capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED)).toEqual([])
      expect(capturedProperties(hostTelemetry, RECOVERY_OUTCOME)).toEqual([])
      await expect(turnLock.approvalCard).toHaveCount(1)
    })

    test('a refused answer on a restored approval reports the failure under the same ask_id', async ({
      turnLock,
      hostTelemetry,
      page
    }) => {
      turnLock.parkOnApproval()
      await turnLock.dropSocket()
      await expect(turnLock.approvalCard).toBeVisible({ timeout: 60_000 })
      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_OUTCOME), {
          timeout: 30_000
        })
        .toMatchObject([{ outcome: 'restored' }])

      await page.route('**/api/agent/threads/*/asks/*/answer', (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unknown thread or ask' })
        })
      )

      await turnLock.runApprovalButton.click()

      await expect(turnLock.runApprovalButton).toBeHidden({ timeout: 30_000 })

      await expect
        .poll(() => capturedProperties(hostTelemetry, ANSWER_FAILED), {
          timeout: 30_000
        })
        .toHaveLength(1)
      expect(turnLock.answeredAsks()).toEqual([])
      expect(capturedProperties(hostTelemetry, RESOLVED)).toEqual([])

      const correlated = [
        ...capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED),
        ...capturedProperties(hostTelemetry, RECOVERY_OUTCOME),
        ...capturedProperties(hostTelemetry, SHOWN),
        ...capturedProperties(hostTelemetry, ANSWER_FAILED)
      ]
      expect(correlated).toHaveLength(4)
      expect(soleAskId(correlated)).toBeDefined()
    })

    test('an approval already settled elsewhere reports a retired outcome with no attempt', async ({
      turnLock,
      hostTelemetry,
      page
    }) => {
      turnLock.primePendingAsk(RUN_APPROVAL_EVENT)
      await page.route('**/api/agent/threads/*/asks/*/answer', (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unknown thread or ask' })
        })
      )

      await page.reload()
      await expect(
        page.getByTestId(TestIds.topbar.integratedTabBarActions)
      ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 30_000 })
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })
      await expect(turnLock.approvalCard).toBeVisible({ timeout: 30_000 })

      await turnLock.runApprovalButton.click({ timeout: 10_000 })
      await expect(turnLock.runApprovalButton).toBeHidden({ timeout: 30_000 })
      await expect
        .poll(() => capturedProperties(hostTelemetry, ANSWER_FAILED), {
          timeout: 30_000
        })
        .toHaveLength(1)

      await turnLock.dropSocket()

      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_OUTCOME), {
          timeout: 60_000
        })
        .toMatchObject([{ outcome: 'retired' }])
      expect(capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED)).toEqual([])

      await expect(turnLock.approvalCard).toHaveCount(0)

      const correlated = [
        ...capturedProperties(hostTelemetry, RECOVERY_OUTCOME),
        ...capturedProperties(hostTelemetry, ANSWER_FAILED)
      ]
      expect(correlated).toHaveLength(2)
      expect(soleAskId(correlated)).toBeDefined()
    })
  }
)
