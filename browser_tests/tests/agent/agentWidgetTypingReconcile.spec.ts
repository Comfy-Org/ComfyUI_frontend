import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * The visible `<textarea>` behind any text widget (`WidgetGrid.vue` /
 * `WidgetTextarea.vue`) binds straight to `widgetValueStore` with no focus
 * guard. When a doc frame's changed-widgets sweep touches that same widget
 * — an unrelated full-graph reconcile, a stale echo, or (as reproduced
 * here) a plain resync — `applyWidgetValues`/`setWidgetValue` in
 * `graphMutations.ts` overwrite the widget's stored value unconditionally,
 * with no check for whether the value it is about to replace is locally
 * newer or the widget is currently focused. Typing fast enough that a doc
 * frame lands mid-keystroke drops whatever was typed since the frame's
 * snapshot.
 *
 * The recorded conversation below has the agent create a fresh CLIPTextEncode
 * node and set its "text" widget as the last step of a real run — exactly
 * the "keep refining the prompt right after the agent finishes" flow this
 * bug was reported against. `resyncWidget` then races one more doc_update
 * against live keystrokes into that same widget, matching how a stale echo,
 * a reconnect resync, or a full reconcile actually reaches
 * `applyWidgetValues`/`setWidgetValue` on the wire.
 */
test.describe(
  'Agent widget value vs CRDT reconcile',
  { tag: ['@cloud', '@widget', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-replace-prompt-encoder' })

    const NEW_NODE_ID = '4181654812796082'
    const APPENDED = ' at sunset, golden hour, cinematic lighting'

    test('typing into a prompt widget survives a doc frame that resyncs it right after the run', async ({
      agentConversation
    }) => {
      test.setTimeout(60_000)
      await agentConversation.runTurns()

      const field = agentConversation.vueNodes
        .getNodeLocator(NEW_NODE_ID)
        .getByLabel('text', { exact: true })
      await expect(field).toHaveValue('a photo of a pier')

      await field.click()
      await field.press('End')

      // Typed via real per-key dispatch, not `.fill()`, which writes the
      // value in one shot and never exercises the store-write/render-flush
      // round trip this bug lives in. The first chunk is typed and awaited
      // so the widget's live value is already partway through `APPENDED`
      // before `resyncWidget` captures it; the remaining chunk is then
      // typed without awaiting the resync first, so the doc frame's
      // store-write round trip lands mid-keystroke instead of racing the
      // very start of `pressSequentially`, before any character has landed.
      const FIRST_CHUNK = APPENDED.slice(0, 5)
      const REST_CHUNK = APPENDED.slice(5)
      await field.pressSequentially(FIRST_CHUNK, { delay: 20 })

      const typing = field.pressSequentially(REST_CHUNK, { delay: 20 })
      void agentConversation.resyncWidget(NEW_NODE_ID, 'text')
      await typing

      const finalValue = await field.inputValue()
      await test.info().attach('typed-vs-final.txt', {
        body: `typed: a photo of a pier${APPENDED}\nfinal: ${finalValue}`,
        contentType: 'text/plain'
      })
      await test.info().attach('widget-after-race.png', {
        body: await agentConversation.vueNodes
          .getNodeLocator(NEW_NODE_ID)
          .screenshot(),
        contentType: 'image/png'
      })

      // This pinned the defect a doc frame that resyncs this exact widget
      // mid-keystroke used to cause: the frame won over the live typed value
      // and dropped whatever the user typed after its snapshot was taken.
      // The stale-echo guard in `graphMutations.setWidget` (PM-1191/PM-1697)
      // fixes it, so the marker comes off here rather than leaving the pin
      // reporting "expected to fail, but passed" on main.
      await expect(field).toHaveValue(`a photo of a pier${APPENDED}`)
    })
  }
)
