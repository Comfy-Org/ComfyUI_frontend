import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * PM-1673: typing into an agent-created multiline text node garbles the input
 * after the agent turn has finished. Three properties of the report shape
 * these tests: the turn was over (no agent write was in flight), the node is a
 * plain `PrimitiveStringMultiline` rather than the `CLIPTextEncode` prompt
 * widget PM-1191 is scoped to, and it was first seen on prod, where the round
 * trip to the doc host is far slower than in any local run.
 *
 * The recorded case is a real run in which the agent adds a
 * `PrimitiveStringMultiline` and sets its `value` widget - the generic
 * multiline text node the report names, reached the way the reporter reached
 * it.
 *
 * `humanOpsHost: 'apply'` is what makes these tests about the reported bug
 * rather than about an injected frame: the fake host judges and broadcasts
 * every op the page mints, so the page's own keystrokes come back to it as
 * `doc_update` frames exactly as prod's doc host returns them.
 */
const CASE = 'agent-l4-zimage-string-node-prompt'
const TEXT_NODE_ID = '3876406316923056'
const TEXT_WIDGET = 'value'
const AGENT_VALUE = 'a red bicycle on a pier at dusk'

// Slow enough that each keystroke's own echo lands before the next one, so a
// spontaneous echo collision cannot decide these tests. The defect needs a
// frame that is stale when it applies, and the only one here is delivered
// deliberately.
const SETTLED_KEYSTROKE_MS = 300

test.describe(
  'Agent-created multiline text node accepts typing after the turn ends (PM-1673)',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    /**
     * The premise behind the report. Once the agent has bound a doc to this
     * workflow the binding outlives the turn - `shouldMint` consults only the
     * product flag, the doc binding and teardown, never whether a turn is
     * running - so `widgetMintPort` mints a `set_widget` op off the
     * `widgetValueStore` `setValue` seam on every keystroke. A user typing
     * into an agent-created widget while the agent sits idle is still driving
     * a write/echo round trip per character, which is why "the agent turn
     * looked over" does not rule out a CRDT race.
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
      await field.pressSequentially('!!', { delay: SETTLED_KEYSTROKE_MS })

      const outcomes = await agentConversation.waitForHumanOps(2)
      expect(
        outcomes.filter((outcome) => outcome.outcome === 'rejected')
      ).toEqual([])
      // The document itself moved, so the round trip is real rather than a
      // frame the page sent and dropped.
      expect(agentConversation.hostWidgetValue(TEXT_NODE_ID, TEXT_WIDGET)).toBe(
        `${AGENT_VALUE}!!`
      )
      await expect(field).toHaveValue(`${AGENT_VALUE}!!`)
    })

    /**
     * The defect. One of those per-keystroke round trips comes back late - on
     * prod that is the latency to the doc host; here one frame is delivered
     * deliberately, carrying the value as of an earlier keystroke.
     * `graphMutations`' `setWidget` case, which is the op shape an echo
     * arrives as, calls `setWidgetValue` directly and never consults
     * `skipStaleReconcile`, so the stale value is written over the newer live
     * one. That guard is reached only from `applyWidgetValues` with
     * `guardLocalEdits` set, which only `reconcileNode` passes.
     *
     * `WidgetGrid.vue` binds the textarea's `model-value` straight at
     * `widgetValueStore`'s value with no local edit buffer, so the store write
     * reaches the focused `<textarea>` through `v-model`'s `beforeUpdate` as
     * `el.value = <stale>`, and the caret collapses to the end of the shorter
     * string with it. Characters typed after the frame lands go in at the
     * collapsed caret, so the result is neither the stale value nor what was
     * typed but the two spliced together - "garbled" rather than reverted.
     *
     * Nothing here is specific to a multiline widget: `set_widget` is
     * name-keyed and every widget in the store is exposed the same way. A
     * multiline text widget is simply the only one a user commits many values
     * to in a row, fast, which is the only way to outrun the echo.
     */
    test('typing survives an echo of an earlier keystroke landing late', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const field = agentConversation.vueNodes
        .getNodeLocator(TEXT_NODE_ID)
        .getByLabel(TEXT_WIDGET, { exact: true })
      await expect(field).toHaveValue(AGENT_VALUE)

      await field.click()
      await field.press('ControlOrMeta+End')

      // Typed per key rather than with `.fill()`, which writes the value in
      // one shot and never exercises the round trip the bug lives in.
      const ECHOED = ' at'
      const OVERTAKEN = ' dawn'
      const DURING = ' 35mm'
      const echoedValue = `${AGENT_VALUE}${ECHOED}`

      await field.pressSequentially(ECHOED, { delay: SETTLED_KEYSTROKE_MS })
      await expect(field).toHaveValue(echoedValue)
      await field.pressSequentially(OVERTAKEN, { delay: SETTLED_KEYSTROKE_MS })
      await expect(field).toHaveValue(`${echoedValue}${OVERTAKEN}`)

      // The echo of the keystroke that finished ECHOED, held back until
      // OVERTAKEN has landed so that it is unambiguously stale when it
      // applies, and released while DURING is still being typed. Delivered
      // any earlier it would match the live value and write nothing.
      const typing = field.pressSequentially(DURING, {
        delay: SETTLED_KEYSTROKE_MS
      })
      agentConversation.pushHostOps([
        {
          op: 'set_widget',
          node_id: Number(TEXT_NODE_ID),
          widget: TEXT_WIDGET,
          value: echoedValue
        }
      ])
      await typing

      const typed = `${echoedValue}${OVERTAKEN}${DURING}`
      await testInfo.attach('typed-vs-rendered.txt', {
        body: [
          `typed:    ${typed}`,
          `rendered: ${await field.inputValue()}`,
          `echo:     ${echoedValue}`,
          `host doc: ${String(
            agentConversation.hostWidgetValue(TEXT_NODE_ID, TEXT_WIDGET)
          )}`
        ].join('\n'),
        contentType: 'text/plain'
      })
      await testInfo.attach('multiline-widget-after-echo.png', {
        body: await agentConversation.vueNodes
          .getNodeLocator(TEXT_NODE_ID)
          .screenshot(),
        contentType: 'image/png'
      })

      // Known defect, pinned rather than fixed here: the late echo wins over
      // the live value, and what is typed after it lands at the collapsed
      // caret.
      test.fail()
      await expect(field).toHaveValue(typed)
    })
  }
)
