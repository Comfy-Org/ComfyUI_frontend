import { expect, mergeTests } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'

import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { WireOpEnvelope } from '@e2e/fixtures/agentWireFrame'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { subscribeAgentWorkflow } from '@e2e/fixtures/utils/subscribeAgentWorkflow'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

const WORKFLOW_ID = 'c7a21d40-0000-4000-8000-000000000050'
const MESSAGE_ID = 'c7a21d40-0000-4000-8000-000000000051'
const THREAD_ID = 'c7a21d40-0000-4000-8000-000000000052'

const TYPED_NOTE = 'remember to swap the LoRA before the final render'

const catalog: WidgetCatalog = { types: {} }

interface OpsFrame {
  type: string
  data: { ops?: WireOpEnvelope[] }
}

function docOpsFrames(frames: readonly string[]): OpsFrame[] {
  return frames
    .map((frame) => JSON.parse(frame) as OpsFrame)
    .filter((frame) => frame.type === 'doc_ops')
}

function relayToHost(
  host: HostDoc,
  socket: WebSocketRoute,
  ops: WireOpEnvelope[]
): void {
  const { result, update } = host.applyWire(ops)
  socket.send(JSON.stringify(result))
  if (update !== null) socket.send(JSON.stringify(update))
}

async function bootWithHost(
  page: Page,
  getAgentSocket: () => Promise<WebSocketRoute>
) {
  await page.setViewportSize({ width: 1920, height: 1280 })
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  })
  await bootAgentApp(page, true, {
    objectInfo: {},
    beforeNavigate: async (page) => {
      await mockAgentTurnApi(page, {
        message_id: MESSAGE_ID,
        thread_id: THREAD_ID,
        workflow_id: WORKFLOW_ID
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
    }
  })
  await loadIntoBootWorkflow(page, BLANK_WORKFLOW)

  const agentPanel = new AgentPanel(page)
  await agentPanel.open()
  const socket = await getAgentSocket()
  const outboundFrames = await subscribeAgentWorkflow({
    agentPanel,
    socket,
    workflowId: WORKFLOW_ID,
    prompt: 'Leave the canvas to me'
  })

  const host = new HostDoc(WORKFLOW_ID, { nodes: [], links: [] }, catalog)
  for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))
  await expect
    .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
    .toBe(0)

  return { host, socket, outboundFrames, vueNodes: new VueNodeHelpers(page) }
}

test.describe(
  'A human edit to a frontend-only node the catalog cannot describe',
  { tag: ['@cloud', '@agent', '@canvas', '@node', '@widget', '@vue-nodes'] },
  () => {
    test.use({ connectWebSocketToServer: false })
    test.describe.configure({ timeout: 90_000 })

    // Red before the fix: the add ships a positional `widgets_values`, the
    // host stores it under `__widgets_opaque` because `Note` has no
    // `widget_order`, and the real applier then refuses the edit
    // `opaque_widgets` — the follower reports it and rolls the text back, so
    // the sticky note cannot be typed in at all. PM-2371.
    test('keeps the text the user typed into a Note, with no rejection notice', async ({
      page,
      toast,
      getAgentSocket
    }) => {
      const { host, socket, outboundFrames, vueNodes } = await bootWithHost(
        page,
        getAgentSocket
      )

      const beforeAdd = outboundFrames.length
      await page.evaluate(() => {
        window.app!.graph.add(window.LiteGraph!.createNode('Note'))
      })
      await expect
        .poll(() => outboundFrames.slice(beforeAdd), { timeout: 15_000 })
        .toContainEqual(expect.stringContaining('"op":"add_node"'))
      for (const frame of docOpsFrames(outboundFrames.slice(beforeAdd)))
        relayToHost(host, socket, frame.data.ops ?? [])
      await nextFrame(page)

      const noteId = await page.evaluate(
        () =>
          window.app!.graph.nodes.find((node) => node.type === 'Note')?.id ??
          null
      )
      expect(noteId).not.toBeNull()

      await page
        .getByRole('button', { name: 'Fit View (.)', exact: true })
        .click()
      const noteText = vueNodes
        .getNodeLocator(String(noteId))
        .getByLabel('text', { exact: true })

      const beforeEdit = outboundFrames.length
      await noteText.fill(TYPED_NOTE)
      await noteText.blur()

      await expect
        .poll(() => outboundFrames.slice(beforeEdit), { timeout: 15_000 })
        .toContainEqual(expect.stringContaining('"op":"set_widget"'))
      for (const frame of docOpsFrames(outboundFrames.slice(beforeEdit)))
        relayToHost(host, socket, frame.data.ops ?? [])
      await nextFrame(page)
      await nextFrame(page)

      // The user-visible outcome, which is the whole assertion: the text they
      // typed is still on the note. Before the fix the follower put the
      // document's value back and this read the empty default.
      await expect(noteText).toHaveValue(TYPED_NOTE)

      // And the shared document agrees, so a reload or another tab shows the
      // same note rather than silently dropping the edit.
      //
      // Name-keyed, beside the form the producer declared: that is the A24
      // round trip, not an accident of this spec. The node is stored under the
      // `self` strategy, so `project()` re-emits the shape the producer sent
      // rather than a positional array it would need a catalog to rebuild.
      // The saved workflow file is untouched by this — it comes from
      // `graph.serialize()`, which still writes `["…"]`.
      const stored = host
        .projection()
        .nodes.find((node) => String(node.id) === String(noteId))
      expect(stored).toMatchObject({
        type: 'Note',
        widgets_values: { text: TYPED_NOTE },
        widgets_values_form: { order: ['text'] }
      })

      // No "rejected" notice, because nothing was rejected. Filtered to the
      // text and required absent on screen, the inverse of the assertion the
      // duplicate-insert spec makes for a genuinely refused write.
      await expect(
        toast.toastErrors.filter({
          hasText: 'Widget edit was rejected and was not saved'
        })
      ).toHaveCount(0)
    })
  }
)
