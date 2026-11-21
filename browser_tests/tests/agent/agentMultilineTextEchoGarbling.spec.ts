import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * PM-1673: typing into an agent-created multiline text node garbles the input
 * after the agent's turn has finished. Three properties of the report shape
 * these tests. The turn was over, so no agent write was in flight. The node is
 * a plain `PrimitiveStringMultiline`, not the `CLIPTextEncode` prompt widget
 * PM-1191 is scoped to. And it was first seen on prod, where the round trip to
 * the doc host is far slower than in any local run.
 *
 * The recorded case is a real run in which the agent adds a
 * `PrimitiveStringMultiline` and sets its `value` widget - the generic
 * multiline text node the report names, reached the way the reporter reached
 * it.
 *
 * `agentConversationReplay.spec.ts`'s "keeps prompt keystrokes when a doc
 * frame resyncs the widget" delivers the colliding write as a HOST-authored
 * frame with the caret at the end of the text, where the outcome is
 * indistinguishable from a plain revert. These two tests instead drive the
 * user's OWN keystroke back late, mid-prompt, where a clobber scatters the
 * typing rather than shortening it.
 */
const CASE = 'agent-l4-zimage-string-node-prompt'
const TEXT_NODE_ID = '3876406316923056'
const TEXT_WIDGET = 'value'
const AGENT_VALUE = 'a red bicycle on a pier at dusk'
// A seed widget the recorded turn never touches, used only as a frame barrier.
const BARRIER_NODE_ID = '9'
const BARRIER_WIDGET = 'filename_prefix'

test.describe(
  'Agent-created multiline text node accepts typing after the turn ends (PM-1673)',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test.describe('keystrokes reach the document', () => {
      test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

      /**
       * The premise behind the report. Once the agent has bound a doc to this
       * workflow the binding outlives the turn - `shouldMint` consults only
       * the product flag, the doc binding and teardown, never whether a turn
       * is running - so `widgetMintPort` mints a `set_widget` op off the
       * `widgetValueStore` `setValue` seam. A user typing into an
       * agent-created widget while the agent sits idle is still driving a
       * write/echo round trip, which is why "the agent turn looked over"
       * does not rule out a CRDT race.
       *
       * One keystroke, deliberately. A second would have to be pressed while
       * the first echo was still in flight - `judgeHumanOps` records its
       * outcome before it sends the update frame, so no host-side signal can
       * say the echo has landed - and racing the two is the very defect the
       * `hold` test below pins. That a mint happens per keystroke rather than
       * once is not this test's to prove: `widgetMintPort.test.ts` pins one
       * op per `setValue`, and `WidgetTextarea.test.ts` pins the emit per
       * input event.
       */
      test('a keystroke after the turn still round-trips through the CRDT host', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        const field = agentConversation.vueNodes
          .getNodeLocator(TEXT_NODE_ID)
          .getByLabel(TEXT_WIDGET, { exact: true })
        await expect(field).toHaveValue(AGENT_VALUE)

        await field.click()
        // Not `End`: the value wraps across two visual lines at this node's
        // width, and `End` stops at the end of the wrapped line it is on.
        await field.press('ControlOrMeta+End')

        await field.press('!')
        const outcomes = await agentConversation.waitForHumanOps(1)

        expect(
          outcomes.filter((outcome) => outcome.outcome === 'rejected')
        ).toEqual([])
        // The document moved, so the round trip is real rather than a frame
        // the page sent and dropped. Polled, because the outcome counter
        // gating the wait above counts every human op the host judges, not
        // this widget's.
        await expect
          .poll(() =>
            agentConversation.hostWidgetValue(TEXT_NODE_ID, TEXT_WIDGET)
          )
          .toBe(`${AGENT_VALUE}!`)
        await expect(field).toHaveValue(`${AGENT_VALUE}!`)
      })
    })

    test.describe('a keystroke echo that arrives late', () => {
      test.use({ conversationCase: CASE, humanOpsHost: 'hold' })

      /**
       * A `hold` host judges nothing until asked, and `opSender` keeps one
       * batch in flight, so the first keystroke's op sits on the host while
       * every later keystroke queues unsent in the page - the same backlog
       * prod's latency produces, made explicit. Releasing that first op has
       * the host judge and broadcast it exactly as it would have at send
       * time, with the client's own actor (`applyWire` stamps the broadcast
       * from the wire op), so what comes back is a genuine echo of the user's
       * first keystroke, arriving two keystrokes late.
       *
       * The follower merges that frame into the doc and skips applying it
       * (`isOwnEcho`), and `LocalWidgetWrites` holds any remote write to a
       * register with a local write still in flight, so the older value never
       * reaches the focused textarea and the caret stays where the user was
       * typing.
       *
       * None of this is specific to a multiline widget - `set_widget` is
       * name-keyed and every widget in the store is exposed the same way. A
       * text widget is simply the one a user commits many values to in a row,
       * fast enough to outrun the echo.
       */
      test('typing mid-prompt survives the late echo of an earlier keystroke', async ({
        agentConversation
      }, testInfo) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        const field = agentConversation.vueNodes
          .getNodeLocator(TEXT_NODE_ID)
          .getByLabel(TEXT_WIDGET, { exact: true })
        await expect(field).toHaveValue(AGENT_VALUE)

        const head = 'a red bicycle'
        const tail = AGENT_VALUE.slice(head.length)
        await field.click()
        await field.press('ControlOrMeta+Home')
        for (let step = 0; step < head.length; step++) {
          await field.press('ArrowRight')
        }

        // Nothing is held before the first keystroke, so the single held op
        // asserted below can only be X's.
        expect(agentConversation.heldHumanOpCount()).toBe(0)
        await field.press('X')
        await expect(field).toHaveValue(`${head}X${tail}`)
        await field.press('Y')
        await expect(field).toHaveValue(`${head}XY${tail}`)

        // X's op is on the host and Y's is still queued behind it, so the
        // release below is unambiguously an echo of the older keystroke.
        await expect.poll(() => agentConversation.heldHumanOpCount()).toBe(1)
        expect(agentConversation.releaseHeldHumanOps()).toBe(1)

        // The echo really is STALE, which is what the title claims and what
        // the barrier below cannot show. `applyWire` reaches the host's doc
        // synchronously, and no client-side fix can move it, so this holds
        // whether or not the defect is fixed - and the widget it names is
        // still a keystroke behind the live one asserted above.
        expect(
          agentConversation.hostWidgetValue(TEXT_NODE_ID, TEXT_WIDGET)
        ).toBe(`${head}X${tail}`)

        // Z must not be typed until the echo has landed, or a clobber would
        // take Y with it and no scatter could form. The barrier is a host
        // edit to an unrelated widget pushed after the release: frames apply
        // in order, so once it renders the echo has been handled too.
        await agentConversation.waitForPendingFrames(
          BARRIER_NODE_ID,
          BARRIER_WIDGET,
          'released echo applied'
        )

        await field.press('Z')

        const typed = `${head}XYZ${tail}`
        await testInfo.attach('typed-vs-rendered.txt', {
          body: [
            `typed:    ${typed}`,
            `rendered: ${await field.inputValue()}`,
            `echo:     ${head}X${tail}`
          ].join('\n'),
          contentType: 'text/plain'
        })
        await testInfo.attach('multiline-widget-after-echo.png', {
          body: await agentConversation.vueNodes
            .getNodeLocator(TEXT_NODE_ID)
            .screenshot(),
          contentType: 'image/png'
        })

        await expect(field).toHaveValue(typed)
      })
    })
  }
)
