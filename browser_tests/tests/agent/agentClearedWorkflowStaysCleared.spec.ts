import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'

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

// The recorded turn adds one node and then clears the workflow, so a canvas
// that ends empty cannot on its own tell "the clear landed" apart from
// "neither operation did" -- which is how a replay skips a clear and still
// reports a pass (PM-1755). Recording every node the DOM has ever mounted
// keeps the two apart without reaching past what the user sees.
async function recordMountedNodes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const mounted = new Set<string>()
    window.__mountedNodeIds = mounted
    const collect = (root: ParentNode) => {
      for (const node of root.querySelectorAll('[data-node-id]')) {
        const id = node.getAttribute('data-node-id')
        if (id !== null) mounted.add(id)
      }
    }
    collect(document)
    new MutationObserver((records) => {
      for (const record of records)
        for (const added of record.addedNodes)
          if (added instanceof Element) {
            const id = added.getAttribute('data-node-id')
            if (id !== null) mounted.add(id)
            collect(added)
          }
    }).observe(document.body, { subtree: true, childList: true })
  })
}

async function mountedNodeIds(page: Page): Promise<string[]> {
  return await page.evaluate(() => [...(window.__mountedNodeIds ?? [])].sort())
}

test.describe(
  'A workflow the Agent cleared',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

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
      // equality one: the recorded ids the agent mints are what matter.
      expect(await mountedNodeIds(page)).toEqual(
        expect.arrayContaining([...added])
      )
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
      const topbar = new Topbar(page)
      const tabs = topbar.tabs

      await agentConversation.runTurns()
      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)

      await expect(tabs).toHaveCount(1)
      await topbar.newWorkflowButton.click()
      await expect(tabs).toHaveCount(2)
      await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()

      // Returning re-subscribes the follower, which replays the bound
      // document over the tab's own snapshot. Waiting for that subscribe is
      // what makes the assertion below about the catch-up rather than about
      // a canvas nothing has touched yet.
      const subscribes = agentConversation.subscribeCount()
      await topbar.getTab(0).click()
      await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBe(subscribes + 1)

      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      for (const id of added)
        await expect(agentConversation.vueNodes.getNodeLocator(id)).toHaveCount(
          0
        )
    })
  }
)
