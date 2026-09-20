import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A recorded turn whose ops add nodes, so "the canvas did not change" is
// visible as a node count rather than inferred from a frame that never came.
const CASE = 'agent-rec-add-set-delete'

// agentCrdtDocLifecycle.ts: SUBSCRIBE_RETRY_BASE_MS = 500 doubling over
// SUBSCRIBE_RETRY_MAX_ATTEMPTS = 6, so the budget is 500+1000+2000+4000+8000+
// 16000 = 31.5s of retries before scheduleSubscribeRetry() stops scheduling.
const SUBSCRIBE_RETRY_ATTEMPTS = 6
const SUBSCRIBE_RETRY_BUDGET_MS = 31_500

test.describe(
  'Agent follower subscribe refusal',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: CASE })

    // Ingest refuses doc_subscribe for reasons the client cannot influence:
    // `unsupported` when the document surface is absent, `overloaded` when the
    // relay cannot queue the subscribe, and a per-session document cap. The
    // follower retries with bounded backoff and then stops. This pins what the
    // user is left with when the budget runs out.
    //
    // Filed from bbc #293 gap 1 (row crdtdeliv-1). The original report claimed
    // no client spoke doc_subscribe at all; that premise is stale — the
    // follower ships and subscribes — so this is the narrower surviving
    // question: a refusal that outlives the retry budget.
    test('retries a refused subscribe, then leaves the canvas silently unchanged', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(120_000)

      await test.step('the host refuses every doc_subscribe', async () => {
        agentConversation.setSubscribeBehavior({
          kind: 'refuse',
          code: 'overloaded',
          message: 'the relay could not queue this subscribe'
        })
      })

      const nodesBefore = await agentConversation.vueNodes.nodes.count()

      // The follower subscribes when a turn binds the workflow, so the prompt
      // is what puts a subscribe on the wire at all. Only the prompt is sent:
      // replaying the response would block on a subscribe that never succeeds.
      await test.step('the user sends a prompt', async () => {
        await agentConversation.sendPrompt(0)
      })

      await test.step('the follower exhausts its retry budget', async () => {
        // Climbing attempts with zero accepted subscribes is the only way to
        // tell "still trying" from "gave up" from outside the page.
        await expect
          .poll(() => agentConversation.subscribeAttemptCount(), {
            timeout: SUBSCRIBE_RETRY_BUDGET_MS + 15_000,
            message:
              'the follower should retry a refused subscribe with bounded backoff'
          })
          .toBeGreaterThanOrEqual(SUBSCRIBE_RETRY_ATTEMPTS)
        expect(agentConversation.subscribeCount()).toBe(0)
      })

      // THE GAP. The turn's ops reached the document server-side and the turn
      // reports success, but no canvas frame can arrive on a subscription that
      // was never established, and nothing user-visible says so: the follower's
      // status feeds CrdtDevPanel only, which is a dev surface.
      //
      // These assertions describe CURRENT behavior deliberately. They are the
      // repro, not the desired end state — see the bug note below.
      await test.step('the canvas never changes and nothing says why', async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(nodesBefore)

        // No alert, status message, or error region mentions the connection.
        const alerts = page.getByRole('alert')
        await expect(alerts).toHaveCount(0)
      })

      // BUG (crdtdeliv-1): when the retry budget is exhausted the follower is
      // permanently inert for this workflow and the user has no signal. The
      // desired behavior is a visible, recoverable state — the assertion below
      // is what should replace the two above once that ships, and it fails
      // today, which is the point of leaving it written down:
      //
      //   await expect(page.getByRole('alert')).toContainText(/reconnect/i)
      //
      // Deliberately NOT fixed in this change: this spec establishes the repro
      // and the harness seam first, per harness-first QA.
    })

    // The recovery direction, which does work today: a refusal that lifts
    // inside the retry budget heals with no user action. Without this, a fix
    // for the case above could regress the retry itself and nothing would
    // notice.
    test('recovers when the refusal lifts inside the retry budget', async ({
      agentConversation
    }) => {
      test.setTimeout(120_000)

      agentConversation.setSubscribeBehavior({
        kind: 'refuse',
        code: 'overloaded'
      })
      await agentConversation.sendPrompt(0)

      await expect
        .poll(() => agentConversation.subscribeAttemptCount(), {
          timeout: 20_000,
          message: 'the follower should have attempted at least one retry'
        })
        .toBeGreaterThanOrEqual(2)
      expect(agentConversation.subscribeCount()).toBe(0)

      agentConversation.setSubscribeBehavior({ kind: 'accept' })

      await expect
        .poll(() => agentConversation.subscribeCount(), {
          timeout: 30_000,
          message:
            'a refusal that lifts inside the budget must heal without user action'
        })
        .toBeGreaterThanOrEqual(1)

      // The turn that was already in flight can now land its ops on the canvas.
      await agentConversation.replayResponse(0)
      await agentConversation.waitForTurnComplete()
      await agentConversation.expectCanvasReplayed(0)
    })
  }
)
