import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'

// Five wired seed nodes; we only need an existing node to copy, the recorded
// turns themselves are never run in this spec.
const SEED_CASE = 'agent-rec-set-widget-existing'

interface RenderedGraphNode {
  id: string
  pos: [number, number]
}

interface RenderedGraphLink {
  fromNode: string
  toNode: string
}

async function readGraph(
  page: Page
): Promise<{ nodes: RenderedGraphNode[]; links: RenderedGraphLink[] }> {
  return page.evaluate(() => {
    const graph = window.app!.graph
    return {
      nodes: graph.nodes.map((node) => ({
        id: String(node.id),
        pos: [node.pos[0], node.pos[1]] as [number, number]
      })),
      links: [...graph.links.values()].map((link) => ({
        fromNode: String(link.origin_id),
        toNode: String(link.target_id)
      }))
    }
  })
}

// A bulk node-add (here, a canvas paste) calls `graph.add(node)`
// before `node.configure(info)` sets the real position, so the CRDT
// layout-mint port snapshots the constructor default `[10, 10]` into the
// `add_node` op it sends (defect A). Racing that send against a workflow-tab
// retarget hits `opSender.abortIfUnbound()`, which settles the already
// transmitted batch 'undeliverable' without checking whether the server
// committed it (defect B). Net effect: the doc keeps a node the client
// believes never made it, and it resurfaces disconnected at [10, 10] on the
// next resubscribe.
//
// Environment note: this spec was authored and could not be executed here
// (no ComfyUI backend reachable on :8188 in this session, matching PR
// #18062's disclosed limitation for the same harness). The mechanism was
// instead proven directly at the unit level in
// src/lib/litegraph/src/LGraphCanvas.clipboard.test.ts and
// src/workbench/extensions/agent/crdt/crossWorkflowPending.test.ts, both of
// which run and fail for the documented reason.
test.describe(
  'pasted node orphaned by a doc retarget',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: SEED_CASE })

    test.fail(
      true,
      'a node pasted right before a workflow-tab retarget reappears disconnected at [10, 10] once the follower resubscribes'
    )

    test('a node pasted right before a doc retarget reappears disconnected at [10, 10] on resubscribe', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const topbar = new Topbar(page)
      const nodes = agentConversation.vueNodes

      const before = await readGraph(page)
      expect(before.nodes.length).toBeGreaterThan(0)
      const sourceId = before.nodes[0].id

      await test.step('copy and paste an existing seed node on the canvas', async () => {
        await nodes.selectNode(sourceId)
        await page.keyboard.press('ControlOrMeta+c')
        await page.keyboard.press('ControlOrMeta+v')
        await expect
          .poll(async () => (await readGraph(page)).nodes.length)
          .toBe(before.nodes.length + 1)
      })

      const pastedId = await test.step('identify the pasted node', async () => {
        const after = await readGraph(page)
        const beforeIds = new Set(before.nodes.map((node) => node.id))
        const pasted = after.nodes.find((node) => !beforeIds.has(node.id))
        if (!pasted) throw new Error('paste did not add a new node')
        return pasted.id
      })

      await test.step('immediately retarget the bound doc to a new tab', async () => {
        // No wait between the paste and the retarget: the in-flight add_node
        // batch should still be unsettled when abortIfUnbound() fires.
        await topbar.newWorkflowButton.click()
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(2)
      })

      await test.step('return to the original tab and let the follower resubscribe', async () => {
        const beforeSubscribes = agentConversation.subscribeCount()
        await topbar.getTab(0).click()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(beforeSubscribes)
      })

      await test.step('assert the orphaned node: structural lens', async () => {
        const graph = await readGraph(page)
        const pasted = graph.nodes.find((node) => node.id === pastedId)
        expect(pasted).toBeDefined()
        expect(pasted!.pos).toEqual([10, 10])
        const isWired = graph.links.some(
          (link) => link.fromNode === pastedId || link.toNode === pastedId
        )
        expect(isWired).toBe(false)
      })

      await test.step('assert the orphaned node: visual lens', async () => {
        await expect(page).toHaveScreenshot(
          'orphaned-pasted-node-at-10-10.png',
          { maxDiffPixels: 500 }
        )
      })
    })
  }
)
