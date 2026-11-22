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

// PM-2636, on top of PM-1738. The recovery path these specs exercise already
// had behavioural coverage (agentApprovalSurvivesSocketDrop.spec.ts); what it
// had no coverage of is the thing production actually reads. PM-1738's health
// pass needs to answer "was a socket-dropped approval ever recovered and
// answered", and that is a join, not a single event: `recovery_attempted` has
// to meet `recovery_outcome`, and both have to meet the `shown`/`resolved`
// pair the panel emits, on one shared `ask_id`.
//
// A unit test can assert each call in isolation and still leave the join
// broken, because the two halves are minted in different files from different
// identities -- `AgentPanelRoot.vue` reads the ask off the rendered card while
// `useAgentSession.ts` reads it off the polled row. So these cases assert the
// key is shared, through a real browser, rather than asserting that five
// functions were called.
//
// Captured at the Desktop host bridge, the way the consent and onboarding
// telemetry specs do: every `useTelemetry()` call in the app lands there
// synchronously, with no batching and no third-party host to decode. The
// registry-call -> PostHog-capture mapping is asserted by
// PostHogTelemetryProvider.test.ts, not here.
const test = mergeTests(agentTurnLockTest, hostTelemetryFixture)

const SHOWN = 'app:agent_run_approval_shown'
const RESOLVED = 'app:agent_run_approval_resolved'
const ANSWER_FAILED = 'app:agent_run_approval_answer_failed'
const RECOVERY_ATTEMPTED = 'app:agent_run_approval_recovery_attempted'
const RECOVERY_OUTCOME = 'app:agent_run_approval_recovery_outcome'

test.describe.configure({ timeout: 180_000 })
test.use({
  connectWebSocketToServer: false,
  // `enable_telemetry` is what gates the host sink in `initHostTelemetry`;
  // without it the bridge is installed and never written to, so every
  // assertion below would read an empty array and pass for the wrong reason.
  workflowSelectionFeatures: { enable_telemetry: true }
})

/** The single `ask_id` every event for one approval has to agree on. */
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

      // The attempt is minted before `ingest`, so it is observable as soon as
      // the card is. The outcome is deliberately deferred by the late-frame
      // grace on a reconnect, so it needs its own poll rather than being read
      // in the same tick.
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

      // The point of the PR: one key joins the recovery pair to the pair the
      // panel emits. Asserting each array separately would pass on five events
      // that name five different asks.
      const correlated = [
        ...capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED),
        ...capturedProperties(hostTelemetry, RECOVERY_OUTCOME),
        ...capturedProperties(hostTelemetry, SHOWN),
        ...capturedProperties(hostTelemetry, RESOLVED)
      ]
      expect(correlated).toHaveLength(4)
      expect(soleAskId(correlated)).toBeDefined()

      // `turn_id` is the secondary key the health pass groups by, and the two
      // halves read it from different places -- the rendered message for the
      // panel's pair, the polled live turn for recovery's. A restored approval
      // is one turn, so they have to agree.
      expect(new Set(correlated.map(({ turn_id }) => turn_id)).size).toBe(1)
    })

    // The server writes the ask row before it publishes the frame, so a poll
    // can restore an ask whose broadcast is merely in flight. That withdraws
    // the lost-frame warning, correctly -- but the attempt has already been
    // counted, and before `superseded` existed the chain simply ended there:
    // one `recovery_attempted`, no outcome, and a health pass unable to tell a
    // recovered approval from an unresolved one. The split also protects the
    // meaning of `restored`, which is what "a frame was lost" is counted from.
    test('a broadcast that merely lagged the poll reports a superseded outcome, not a restored one', async ({
      turnLock,
      hostTelemetry
    }) => {
      turnLock.parkOnApproval()
      const reconnected = await turnLock.dropSocket()

      // The attempt is minted immediately before `ingest`, and the grace
      // window starts with the restore that follows it -- so poll tightly and
      // push the broadcast while that window is still open. A loose interval
      // would let the grace expire first and report `restored`.
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

      // The user-visible half: the late frame must not draw a second card.
      await expect(turnLock.approvalCard).toHaveCount(1)

      const correlated = [
        ...capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED),
        ...capturedProperties(hostTelemetry, RECOVERY_OUTCOME),
        ...capturedProperties(hostTelemetry, SHOWN)
      ]
      expect(correlated).toHaveLength(3)
      expect(soleAskId(correlated)).toBeDefined()
    })

    // Without this, the case above would pass on a build that emitted the
    // recovery pair for every approval ever drawn, which would make the
    // denominator meaningless: the whole question is how often the lost-frame
    // path fired, not how often an approval appeared.
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

      // Recovery re-reads the persisted row on every poll, so the row still
      // naming this ask is the case that could wrongly report a recovery.
      // Counting the polls rather than asserting an empty array straight away
      // is the whole point: an empty array proves nothing until recovery has
      // actually looked at a row that names an ask it could have restored.
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

    // `agent_run_approval_answer_failed` is the event that tells the health
    // pass a restored approval was recovered and still could not be answered
    // -- a recovery that looks successful and leaves the user exactly as
    // stuck. 404 is one of `REFUSED_ANSWER_STATUSES`, so this is the
    // permanent-refusal arm rather than a retry.
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

      // Registered after the fixture's own answer route, so this one wins.
      await page.route('**/api/agent/threads/*/asks/*/answer', (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unknown thread or ask' })
        })
      )

      await turnLock.runApprovalButton.click()

      // The user-visible half of a refusal: the card retires rather than
      // staying answerable, which is the state the health pass is trying to
      // count -- recovered, and still stuck.
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

    // The `retired` arm, which the PR shipped covered by code review only.
    // Its documented contract is that it carries NO preceding
    // `recovery_attempted`, because nothing was attempted -- the ask was
    // already settled through another path before the poll found it. That
    // contract is what makes `attempted` usable as a denominator, so it is
    // worth an executable case rather than a comment.
    //
    // Reached the way production reaches it: a card drawn by REST hydration is
    // never in the session's delivered-ask ledger, and the refusal arm of
    // `handleAnswerFailure` retires it permanently without adding it. The
    // server's row still names the ask, because the refused POST never
    // recorded an answer.
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

      // A fresh reconnect gives recovery a reason to poll the row again. The
      // row still names the ask the panel just retired, which is exactly the
      // state `retired` exists to report.
      await turnLock.dropSocket()

      await expect
        .poll(() => capturedProperties(hostTelemetry, RECOVERY_OUTCOME), {
          timeout: 60_000
        })
        .toMatchObject([{ outcome: 'retired' }])
      expect(capturedProperties(hostTelemetry, RECOVERY_ATTEMPTED)).toEqual([])

      // The user-visible half: a settled approval must not be redrawn by the
      // poll that reported it.
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
