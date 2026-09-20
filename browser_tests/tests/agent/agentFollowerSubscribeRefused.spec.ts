import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A recorded turn that adds, sets and deletes nodes, so the document's node
// count provably MOVES when the ops are applied — which is what makes "the
// canvas did not follow it" a real assertion rather than a vacuous one. The
// net can move either way; the test asserts divergence, not growth.
const CASE = 'agent-rec-add-set-delete'

// agentCrdtDocLifecycle.ts: SUBSCRIBE_RETRY_BASE_MS = 500 doubling over
// SUBSCRIBE_RETRY_MAX_ATTEMPTS = 6, so the budget is 500+1000+2000+4000+8000+
// 16000 = 31.5s of retries before scheduleSubscribeRetry() stops scheduling.
const SUBSCRIBE_RETRY_ATTEMPTS = 6
const SUBSCRIBE_RETRY_BUDGET_MS = 31_500
// The host counts the INITIAL doc_subscribe as well as each retry, so an
// exhausted follower has sent 1 + 6 = 7 and must never send an eighth.
const TERMINAL_SUBSCRIBE_ATTEMPTS = SUBSCRIBE_RETRY_ATTEMPTS + 1
// Had a seventh retry been scheduled its delay would be 500 * 2^6 = 32s.
// Waiting past that is what turns "has not retried yet" into "has stopped".
const NEXT_BACKOFF_MS = 32_000

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
      test.setTimeout(180_000)

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

      // The agent's edit lands in the document server-side. Its doc_update goes
      // to the workflow channel this client never joined, so it never arrives —
      // that omission is the scenario, and applying host-side only is what
      // models it. Without this the canvas assertion below is vacuous: nothing
      // would ever have tried to change the canvas, so it would pass against a
      // perfectly healthy follower too.
      const hostNodes =
        await test.step('the agent edit lands in the document the client cannot see', () => {
          const hostBefore = agentConversation.hostNodeCount()
          const after = agentConversation.applyOpsHostSideOnly(0)
          // The recorded turn adds, sets AND deletes, so the net node count can
          // move either way. What matters is that the document moved at all and
          // now differs from what the canvas is showing.
          expect(after).not.toBe(hostBefore)
          expect(after).not.toBe(nodesBefore)
          return after
        })

      await test.step('the follower exhausts its retry budget', async () => {
        // Climbing attempts with zero accepted subscribes is the only way to
        // tell "still trying" from "gave up" from outside the page. The count
        // includes the initial subscribe, so exhaustion is exactly 7.
        await expect
          .poll(() => agentConversation.subscribeAttemptCount(), {
            timeout: SUBSCRIBE_RETRY_BUDGET_MS + 20_000,
            message:
              'the follower should retry a refused subscribe with bounded backoff'
          })
          .toBe(TERMINAL_SUBSCRIBE_ATTEMPTS)
        expect(agentConversation.subscribeCount()).toBe(0)
      })

      await test.step('and then stops retrying entirely', async () => {
        // A seventh retry would have been scheduled 32s out, so sitting past
        // that window is what separates "has not retried yet" from "has given
        // up". Expressed as a poll that must NEVER succeed rather than a sleep:
        // it occupies the whole window, and if an eighth attempt ever appears
        // the inner poll resolves and this line fails. The stale probe cannot
        // confuse the count — onSubscribeRefused() clears it, so it is never
        // armed while the subscription is refused.
        await expect(
          expect
            .poll(() => agentConversation.subscribeAttemptCount(), {
              timeout: NEXT_BACKOFF_MS + 3_000
            })
            .toBeGreaterThan(TERMINAL_SUBSCRIBE_ATTEMPTS)
        ).rejects.toThrow()

        expect(agentConversation.subscribeAttemptCount()).toBe(
          TERMINAL_SUBSCRIBE_ATTEMPTS
        )
        expect(agentConversation.subscribeCount()).toBe(0)
      })

      // THE GAP. The document and the user's canvas have now genuinely
      // diverged, and nothing user-visible says so: the follower's status feeds
      // CrdtDevPanel only, which is a dev surface.
      //
      // These assertions describe CURRENT behavior deliberately. They are the
      // repro, not the desired end state — see the bug note below.
      await test.step('the canvas stays behind the document, silently', async () => {
        expect(agentConversation.hostNodeCount()).toBe(hostNodes)
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
