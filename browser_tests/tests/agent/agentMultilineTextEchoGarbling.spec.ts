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
 * What is already covered elsewhere, and what is not:
 * `graphMutations.test.ts`'s `it.fails('preserves a locally newer widget value
 * across a direct setWidget op')` pins the store-level clobber, and
 * `agentConversationReplay.spec.ts`'s "keeps prompt keystrokes when a doc
 * frame resyncs the widget" pins its effect on a widget being typed into. Both
 * deliver the colliding write as a HOST-authored frame, and both leave the
 * caret at the end of the text, where the outcome is indistinguishable from a
 * plain revert. Neither therefore reproduces what the report actually
 * describes: the user's OWN keystroke coming back late and scattering their
 * typing. That is what these two tests add.
 */
const CASE = 'agent-l4-zimage-string-node-prompt'
const TEXT_NODE_ID = '3876406316923056'
const TEXT_WIDGET = 'value'
const AGENT_VALUE = 'a red bicycle on a pier at dusk'

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
       * `widgetValueStore` `setValue` seam on every keystroke. A user typing
       * into an agent-created widget while the agent sits idle is still
       * driving a write/echo round trip per character, which is why "the
       * agent turn looked over" does not rule out a CRDT race.
       */
      test('each keystroke after the turn still round-trips through the CRDT host', async ({
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

        // Each keystroke is let settle against the host's own verdict rather
        // than a delay, so neither character races the other's echo.
        await field.press('!')
        await agentConversation.waitForHumanOps(1)
        await field.press('!')
        const outcomes = await agentConversation.waitForHumanOps(2)

        expect(
          outcomes.filter((outcome) => outcome.outcome === 'rejected')
        ).toEqual([])
        // The document moved, so the round trip is real rather than a frame
        // the page sent and dropped.
        expect(
          agentConversation.hostWidgetValue(TEXT_NODE_ID, TEXT_WIDGET)
        ).toBe(`${AGENT_VALUE}!!`)
        await expect(field).toHaveValue(`${AGENT_VALUE}!!`)
      })
    })

    test.describe('a keystroke echo that arrives late', () => {
      test.use({ conversationCase: CASE, humanOpsHost: 'hold' })

      /**
       * The defect, driven by the user's own keystrokes and nothing else.
       *
       * A `hold` host judges nothing until asked, and `opSender` keeps one
       * batch in flight, so the first keystroke's op sits on the host while
       * every later keystroke queues unsent in the page - the same backlog
       * prod's latency produces, made explicit. Releasing that first op has
       * the host judge and broadcast it exactly as it would have at send
       * time, with the client's own actor (`applyWire` stamps the broadcast
       * from the wire op), so what comes back is a genuine echo of the user's
       * first keystroke, arriving two keystrokes late.
       *
       * `graphMutations`' `setWidget` case, the op shape an echo arrives as,
       * calls `setWidgetValue` directly and never consults
       * `skipStaleReconcile` - that guard is reached only from
       * `applyWidgetValues` with `guardLocalEdits` set, which only
       * `reconcileNode` passes. So the echo's older value is written over the
       * newer live one. `WidgetGrid.vue` binds the textarea's `model-value`
       * straight at `widgetValueStore`'s value with no local edit buffer, so
       * that store write reaches the focused `<textarea>` through `v-model`'s
       * `beforeUpdate` as `el.value = <stale>`, and the caret collapses to
       * the end of the assigned string.
       *
       * Typing mid-prompt is what makes the result legible as garbling rather
       * than as a revert: the caret does not collapse back to where the user
       * was typing, it collapses to the END of the text. Of the three
       * characters typed at one spot, the first survives there, the second is
       * destroyed, and the third lands at the far end of the prompt.
       *
       * None of this is specific to a multiline widget - `set_widget` is
       * name-keyed and every widget in the store is exposed the same way. A
       * text widget is simply the one a user commits many values to in a row,
       * fast enough to outrun the echo.
       */
      test('typing mid-prompt is scattered by the echo of an earlier keystroke', async ({
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

        await field.press('X')
        await expect(field).toHaveValue(`${head}X${tail}`)
        await field.press('Y')
        await expect(field).toHaveValue(`${head}XY${tail}`)

        // X's op is on the host and Y's is still queued behind it, so the
        // release below is unambiguously an echo of the older keystroke.
        await expect.poll(() => agentConversation.heldHumanOpCount()).toBe(1)
        expect(agentConversation.releaseHeldHumanOps(1)).toBe(1)
        await expect(field).toHaveValue(`${head}X${tail}`)

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

        // Guards, so the `test.fail()` below swallows only the defect: the
        // widget is still there and still holds the characters that were
        // typed into it. A wipe, a detached node or lost input would be a
        // different bug and must not read as this one.
        await expect(field).toBeVisible()
        await expect(field).toHaveValue(/X/)
        await expect(field).toHaveValue(/Z/)

        // Known defect, pinned rather than fixed here: Y is destroyed by the
        // echo and Z lands at the end of the prompt instead of beside X.
        test.fail()
        await expect(field).toHaveValue(typed)
      })
    })
  }
)
