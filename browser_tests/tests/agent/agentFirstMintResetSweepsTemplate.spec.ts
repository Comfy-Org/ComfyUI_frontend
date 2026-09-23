import type { WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * Regression coverage: opening a template workflow that has never had an
 * agent session bound to it, then sending ANY agent turn (even a read-only
 * one), used to make the whole canvas visually disappear and reappear
 * ~0.3-0.5s later.
 *
 * Backend (`Comfy-Org/cloud`): a turn's turn-start focus step
 * (`focusWorkflow`, `services/agent/internal/loop/tabs.go:380-444`) runs
 * `ensureDoc` (`crdt.go:2191-2228`), which lazily creates a workflow's CRDT
 * doc the FIRST TIME any agent turn touches it, attributed to actor
 * `system:mint` (`crdt.go:2094-2096`). This broadcasts a `doc_reset` at seq 1
 * to any follower that had already subscribed, with NO accompanying
 * `doc_update` -- pinned by the backend's own
 * `TestLazyMintBroadcastsDocResetToEarlyFollowers`
 * (`services/agent/internal/loop/crdt_premint_follower_test.go:15-55`). This
 * part is expected/correct backend behavior, not the bug.
 *
 * Frontend (this repo): `AgentCrdtProjection.clearForReset`
 * (`src/workbench/extensions/agent/crdt/agentCrdtProjection.ts:55-59`) used to
 * sweep the whole canvas on ANY `doc_reset` frame, unconditionally, with no
 * carve-out for actor `system:mint` -- fired from `useAgentCrdtFollower.ts`'s
 * `onDocReset` (~473-503). A benign first-mint reset (there is no prior
 * CRDT-tracked content to lose -- the template's nodes below are pure local
 * content, never touched by CRDT before this turn) was treated identically
 * to a real, content-losing reset, wiping the already-rendered template
 * nodes until a resubscribe's catch-up repopulated them.
 *
 * `onDocReset` now skips `clearForReset` when the reset frame's actor is
 * `system:mint`, so the two template nodes stay put across the reset below.
 */

const WORKFLOW_ID = 'c9a1e5c2-4f3b-4a8e-9d2f-6b7a8c9d0e1f'
const THREAD_ID = 'e2b3c4d5-6f7a-4b8c-9d0e-1f2a3b4c5d6e'
const MESSAGE_ID = 'f3c4d5e6-7a8b-4c9d-0e1f-2a3b4c5d6e7f'

const TEMPLATE_NODE_A_ID = 501
const TEMPLATE_NODE_B_ID = 502

// A minimal two-node "template": pure local graph content the user would
// see the instant a template opens, well before the agent (or its CRDT
// doc) ever gets involved.
const TEMPLATE_GRAPH: ComfyWorkflowJSON = {
  last_node_id: TEMPLATE_NODE_B_ID,
  last_link_id: 0,
  nodes: [
    {
      id: TEMPLATE_NODE_A_ID,
      type: 'MarkdownNote',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['template node a']
    },
    {
      id: TEMPLATE_NODE_B_ID,
      type: 'MarkdownNote',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['template node b']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

// The CRDT doc host never received any content for this workflow -- exactly
// the "never had an agent session bound to it" precondition.
const EMPTY_HOST_SEED: WorkflowJSON = { nodes: [], links: [] }
const EMPTY_CATALOG: WidgetCatalog = { types: {} }

/**
 * Parses a raw `/ws` message down to its `doc_subscribe` payload for
 * `WORKFLOW_ID`, or `null` for any other frame. Extracted to keep the mock's
 * `onMessage` handler to the post-parse decision. A parse failure here must
 * not throw inside the mock's message handler -- that would silently kill
 * the subscribe ack and degrade the test into a vacuous pass instead of a
 * clear failure.
 */
function parseDocSubscribeForWorkflow(raw: Buffer | string): boolean {
  let frame: unknown
  try {
    frame = JSON.parse(raw.toString())
  } catch {
    return false
  }
  if (typeof frame !== 'object' || frame === null) return false
  const { type, data } = frame as { type?: unknown; data?: unknown }
  if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
    return false
  const { workflow_id } = data as { workflow_id?: unknown }
  return workflow_id === WORKFLOW_ID
}

/**
 * Counts `doc_subscribe` frames the mock has seen for `WORKFLOW_ID` and lets
 * callers await a specific count instead of a timing proxy (socket open,
 * a screenshot). The first subscribe is the turn's own follower binding; the
 * second is `LayoutFollowerBridge`'s unconditional resubscribe after the
 * mint reset below replaces the doc -- a deterministic signal that the reset
 * has actually been processed (skip decision made, doc dropped, resubscribe
 * sent) before assertions run.
 */
function createSubscribeTracker(): {
  recordSubscribe: () => void
  waitForCount: (target: number) => Promise<void>
} {
  let count = 0
  const waiters: { target: number; resolve: () => void }[] = []
  return {
    recordSubscribe: () => {
      count++
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (count >= waiters[i].target) {
          waiters[i].resolve()
          waiters.splice(i, 1)
        }
      }
    },
    waitForCount: (target) => {
      if (count >= target) return Promise.resolve()
      return new Promise((resolve) => waiters.push({ target, resolve }))
    }
  }
}

test.describe(
  'Agent first turn on a template that has never had a CRDT doc',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('does not sweep already-rendered template nodes off the canvas on the first-mint doc_reset', async ({
      page
    }) => {
      // No prior CRDT content anywhere for this workflow -- the follower's
      // subscribe below gets an ack and nothing else to catch up on.
      const host = new HostDoc(WORKFLOW_ID, EMPTY_HOST_SEED, EMPTY_CATALOG)
      const vueNodes = new VueNodeHelpers(page)

      let socket: WebSocketRoute | null = null
      const subscribeTracker = createSubscribeTracker()
      const send = (frame: AgentWsEvent | HostFrame): void => {
        if (
          (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
          parseServerDocFrame(frame) === null
        )
          throw new Error(`frame ${frame.type} is not a valid doc frame`)
        if (!socket) throw new Error('the app has not opened /ws yet')
        socket.send(JSON.stringify(frame))
      }

      await page.routeWebSocket(/\/ws/, (ws) => {
        socket = ws
        ws.onMessage((raw) => {
          if (!parseDocSubscribeForWorkflow(raw)) return
          subscribeTracker.recordSubscribe()
          send(host.subscribed())
        })
      })

      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })

      // Opening the template: the two nodes render from local graph data,
      // with no CRDT doc ever having existed for this workflow. Passing the
      // boot-time active workflow as the 4th arg makes this load reuse that
      // SAME tab -- omitting it (as app.loadGraphData(json, true, true)
      // does) makes activateLoadedWorkflow's null-workflow branch mint a
      // brand new "Unsaved Workflow (2)" tab instead, leaving two tabs open.
      // agentPanel.selectWorkflow() below then targets the first, ORIGINAL,
      // still-empty "Unsaved Workflow" tab by its exact name, switching the
      // canvas away from the just-rendered template nodes before the CRDT
      // follower is ever bound.
      await page.evaluate(async (json) => {
        const activeWorkflow = (window.app!.extensionManager as WorkspaceStore)
          .workflow.activeWorkflow
        await window.app!.loadGraphData(
          json,
          true,
          true,
          activeWorkflow ?? undefined
        )
      }, TEMPLATE_GRAPH)
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Check the workflow.')

      // The turn's acceptance ack binds this workflow and subscribes the
      // CRDT follower -- an "early follower" relative to the mint below.
      // Waiting for the subscribe frame itself (rather than just the socket
      // opening) is what guarantees the reset sent further down actually
      // lands on a follower that is subscribed to WORKFLOW_ID: sending it
      // any earlier would be dropped by
      // `LayoutFollowerBridge.onDocReset`'s `sentWorkflowId` check and the
      // test would pass whether or not the fix under test works.
      await subscribeTracker.waitForCount(1)

      // Baseline: subscribing to a workflow whose CRDT doc has never been
      // minted delivers nothing to catch up on, and correctly leaves the
      // locally-rendered template nodes alone. This is current, correct
      // behavior -- not the bug under test.
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()

      // The first agent turn touching this workflow -- a read-only tool
      // call is enough, matching the real report.
      send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-print',
          tool_name: 'print_workflow',
          status: 'success',
          duration_ms: 40,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })

      // The backend's lazy `ensureDoc` mints the doc for the very first
      // time and broadcasts this reset to the already-subscribed follower,
      // with no accompanying `doc_update` -- see the file-level comment.
      // Nothing tracked by the CRDT doc existed before this moment, so
      // there is nothing here to lose.
      send({
        type: 'doc_reset',
        data: { v: 1, workflow_id: WORKFLOW_ID, seq: 1, actor: 'system:mint' }
      })

      // Deterministic post-reset signal: `LayoutFollowerBridge.onDocReset`
      // unconditionally drops the old doc and resubscribes once it has
      // dispatched `doc_reset` (which is where the skip decision under test
      // is made) -- regardless of whether that decision skipped the sweep.
      // Waiting for this second subscribe therefore proves the reset has
      // been fully processed before the assertions below run, instead of
      // relying on `page.screenshot()`'s incidental timing or the
      // already-visible pre-reset DOM state.
      await subscribeTracker.waitForCount(2)

      // Visual proof of the (non-)flicker: the canvas should look identical
      // before and after the mint reset.
      await page.screenshot({
        path: test.info().outputPath('template-after-mint-reset.png')
      })

      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()
    })
  }
)
