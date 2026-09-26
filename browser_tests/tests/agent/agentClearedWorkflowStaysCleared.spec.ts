import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

// Re-authored guard for the bug PR #18702 was closed without merging: ask the
// agent to clear the canvas and the turn reports the tab is empty while the
// nodes stay on screen (PM-1500, PM-1504; QA's staging report against the
// template-replace shape of the same turn).
//
// #18702 stated the property against `AgentCrdtProjection` and
// `EcsFollowerAdapter`, on a base branch that is not landing, so it stated it
// twice over in code the remote-apply rewrite deletes. This states the same
// property where the user reads it -- the rendered canvas -- and asserts no
// symbol that rewrite removes.
//
// Lands green on `main`: a pin, not a live repro. The dropped-batch mechanism
// #18702 drove the bug through (a mutation batch rejected because the app
// briefly cannot resolve which workflow tab the edit is bound to) has no
// surviving surface to inject it from -- the rewrite deletes the scope gate
// rather than fixing it -- so what is worth holding is the user-visible
// outcome on both sides of that change.
const CASE = 'agent-rec-clear-workflow'

// A host add pushed after the tab-return catch-up. Frames reach the follower
// in order on one channel, so once this renders, the catch-up ahead of it has
// been applied -- which is what makes the emptiness assertions below about the
// catch-up rather than about a canvas that has not processed it yet.
// `CLIPTextEncode` is the one class this recording's catalog carries.
const MARKER_NODE_ID = 424242
const MARKER_ADD: RecordedGraphOperation = {
  op: 'add_node',
  node_id: MARKER_NODE_ID,
  class_type: 'CLIPTextEncode',
  pos: [0, 0],
  node: {
    id: MARKER_NODE_ID,
    type: 'CLIPTextEncode',
    pos: [0, 0],
    size: [240, 86],
    mode: 0,
    flags: {},
    order: 0,
    inputs: [{ link: null, name: 'clip', type: 'CLIP' }],
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
    properties: {},
    widgets_values: [null]
  }
}

// The recorded turn adds one node and then clears the workflow, so a canvas
// that ends empty cannot on its own tell "the clear landed" apart from
// "neither operation did" -- which is how a replay skips a clear and still
// reports a pass (PM-1755). Recording every node the DOM has ever mounted
// keeps the two apart without reaching past what the user sees.
//
// Scoped to the document, like the `[data-node-id]` locator the emptiness
// assertions use, so the positive control and the assertion it controls read
// the same set of elements.
async function recordMountedNodes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const mounted = new Set<string>()
    window.__mountedNodeIds = mounted
    const remember = (element: Element) => {
      const id = element.getAttribute('data-node-id')
      if (id !== null) mounted.add(id)
    }
    const collect = (root: ParentNode) => {
      for (const element of root.querySelectorAll('[data-node-id]'))
        remember(element)
    }
    collect(document)
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        // `data-node-id` can be written onto an element that is already in the
        // DOM, which no `childList` record reports.
        if (record.type === 'attributes') {
          if (record.target instanceof Element) remember(record.target)
          continue
        }
        for (const added of record.addedNodes)
          if (added instanceof Element) {
            remember(added)
            collect(added)
          }
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-node-id']
    })
    window.__mountedNodeObserver = observer
  })
}

// The recorder walks every added subtree, so it stops once its reading has
// been taken rather than running for the rest of the test.
async function stopRecordingMountedNodes(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__mountedNodeObserver?.disconnect()
  })
}

async function mountedNodeIds(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const mounted = window.__mountedNodeIds
    // Absent means the recorder never installed, or a navigation wiped it.
    // That is not the same as nothing having mounted, and telling those two
    // apart is the whole reason this probe exists -- so it must not read as
    // an empty set.
    if (!mounted)
      throw new Error(
        'window.__mountedNodeIds is absent: recordMountedNodes() never ran, or a navigation wiped it'
      )
    return [...mounted].sort()
  })
}

test.describe(
  'A workflow the Agent cleared',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    // The recorded add (`at_ms` 8072) and clear (`16756`) replay back to back
    // under the default `immediate` timing, so the added node can go from
    // absent to removed without a render in between and the positive control
    // below would be asserting a node the app was never given time to mount.
    // Replaying the recorded gaps puts a rendered checkpoint between them.
    test.use({ conversationCase: CASE, replayTiming: 'recorded' })

    test('leaves the canvas empty of the node the same turn put on it', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const added = agentConversation.addedNodeIds()
      expect(added.length).toBeGreaterThan(0)

      await recordMountedNodes(page)
      await agentConversation.runTurns()

      // Boot loads a canvas of its own, so this is a containment check, not an
      // equality one: the recorded ids the agent mints are what matter. Polled
      // because `MutationObserver` delivers its records asynchronously.
      await expect
        .poll(() => mountedNodeIds(page))
        .toEqual(expect.arrayContaining([...added]))
      await stopRecordingMountedNodes(page)

      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      for (const id of added)
        await expect(agentConversation.vueNodes.getNodeLocator(id)).toHaveCount(
          0
        )
    })

    test('is still empty after the user leaves the tab and comes back', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const added = agentConversation.addedNodeIds()
      expect(added.length).toBeGreaterThan(0)
      const topbar = new Topbar(page)
      const tabs = topbar.tabs

      // Same positive control as the first case: without it, a replay that
      // dropped the add would leave this test asserting that an empty canvas
      // is empty.
      await recordMountedNodes(page)
      await agentConversation.runTurns()
      await expect
        .poll(() => mountedNodeIds(page))
        .toEqual(expect.arrayContaining([...added]))
      await stopRecordingMountedNodes(page)
      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)

      await expect(tabs).toHaveCount(1)
      await topbar.newWorkflowButton.click()
      await expect(tabs).toHaveCount(2)
      await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()

      // Returning re-subscribes the follower, which replays the bound
      // document over the tab's own snapshot.
      const subscribes = agentConversation.subscribeCount()
      await topbar.getTab(0).click()
      await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
      // At least one more, not exactly one: the blank tab may still be
      // settling when the count above is read, and its own late subscribe
      // would make an exact match unreachable -- failing on the poll timeout
      // instead of on the canvas state this test is about.
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBeGreaterThanOrEqual(subscribes + 1)

      // That counter rises when the host has SENT the catch-up, not when the
      // follower applied it, so asserting emptiness on the strength of it
      // would resolve on the first poll against a canvas that has not
      // processed the frame -- and would still pass if the cleared node came
      // back with it. The marker is the barrier: it is queued behind the
      // catch-up, so its arrival on screen proves the catch-up has landed.
      agentConversation.pushHostOps([MARKER_ADD])
      await expect(
        agentConversation.vueNodes.getNodeLocator(String(MARKER_NODE_ID))
      ).toBeVisible()

      for (const id of added)
        await expect(agentConversation.vueNodes.getNodeLocator(id)).toHaveCount(
          0
        )
      // The barrier itself is the only node the catch-up left on the canvas.
      await expect(agentConversation.vueNodes.nodes).toHaveCount(1)
    })
  }
)
