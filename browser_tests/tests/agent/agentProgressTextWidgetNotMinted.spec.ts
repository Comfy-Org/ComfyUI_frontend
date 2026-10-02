import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/**
 * FE-3161 sub-cause C2, measured in production (`cloud-frontend-prod`,
 * `1.55.16`): a `set_widget` the user never made is minted from their own
 * canvas, the doc host refuses it, and the frontend tells them their edit was
 * rejected and reverts it.
 *
 * `$$node-text-preview` is a frontend-only progress widget injected at run
 * time by `useNodeProgressText`, built with `serialize: false` and
 * `read_only: true`. It is registered in `widgetValueStore`, so every
 * `progress_text` frame streaming execution status into it fired a `local`
 * `set_widget` intent. The snapshot mint path already dropped it
 * (`valueWidgetsOnly`); the incremental path (`mintSetWidget`) applied no
 * filter, so the op went out, the host answered `unknown_widget`, and
 * `revertRejectedOps` reverted it behind a toast — for a widget that is not
 * part of the workflow and was never an edit.
 *
 * The second case is the severity amplifier FE-3161 records as a live code
 * path rather than a production observation: `applyOps` is abort-remainder,
 * the minter enqueues a whole tick's intents together, and `revertRejectedOps`
 * reverts every op in the batch that did not apply. An unsatisfiable ephemeral
 * write minted in the same tick as a genuine hand edit therefore took the hand
 * edit down with it.
 *
 * Both run against a REAL host: `AgentFollowerHostSocket` in `apply` mode
 * judges every client batch with the real `comfy-multi-player` applier, so the
 * rejection code and the abort-remainder verdict are the library's, not a
 * hand-written frame's.
 */

const NODE_TYPE = 'KSampler'
const NODE_ID = 501
const WORKFLOW_ID = 'c4e2d5b3-0000-4000-8000-000000000060'
const MESSAGE_ID = 'c4e2d5b3-0000-4000-8000-000000000061'
const THREAD_ID = 'c4e2d5b3-0000-4000-8000-000000000062'
const SOCKET_SID = 'c4e2d5b3-0000-4000-8000-000000000063'

const PREVIEW_WIDGET = '$$node-text-preview'
const SEED_VALUE = 111111
const EDITED_SEED_VALUE = 222222
const PROGRESS_TEXT = 'Status: Running\nTime elapsed: 3s'
const LATER_PROGRESS_TEXT = 'Status: Running\nTime elapsed: 9s'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'KSampler',
  description: '',
  category: 'sampling',
  python_module: 'nodes',
  output_node: false,
  input: {
    required: {
      seed: ['INT', { default: 0, min: 0, max: 2147483647 }],
      steps: ['INT', { default: 20, min: 1, max: 10000 }]
    }
  },
  output: ['LATENT'],
  output_is_list: [false],
  output_name: ['LATENT']
}

const catalog: WidgetCatalog = {
  types: { [NODE_TYPE]: { widget_order: ['seed', 'steps'] } }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: NODE_ID,
      type: NODE_TYPE,
      pos: [0, 0],
      size: [270, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
      properties: {},
      widgets_values: [SEED_VALUE, 20]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

/** Binary WS frame type 3 (`progress_text`): [u32 type][u32 idLen][id][text]. */
function progressTextFrame(nodeId: string, text: string): Buffer {
  const id = Buffer.from(nodeId, 'utf8')
  const body = Buffer.from(text, 'utf8')
  const frame = Buffer.alloc(8 + id.length + body.length)
  frame.writeUInt32BE(3, 0)
  frame.writeUInt32BE(id.length, 4)
  id.copy(frame, 8)
  body.copy(frame, 8 + id.length)
  return frame
}

interface Rig {
  host: HostDoc
  hostSocket: AgentFollowerHostSocket
  vueNodes: VueNodeHelpers
}

/** The live value of one widget on the node under test. */
function widgetValue(page: Page, name: string): Promise<unknown> {
  return page.evaluate(
    ({ nodeId, name }) =>
      window
        .app!.graph.nodes.find((node) => String(node.id) === nodeId)
        ?.widgets?.find((widget) => widget.name === name)?.value,
    { nodeId: String(NODE_ID), name }
  )
}

/**
 * Boots the agent app on a document the host already holds, with the host
 * judging every client batch through the real applier.
 */
async function bootBoundToHost(page: Page): Promise<Rig> {
  const host = new HostDoc(WORKFLOW_ID, seed, catalog)
  const hostSocket = new AgentFollowerHostSocket(
    page,
    WORKFLOW_ID,
    host,
    SOCKET_SID,
    'apply'
  )
  await hostSocket.install()

  await bootAgentApp(page, true, {
    objectInfo: { [NODE_TYPE]: nodeDef },
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

  const agentPanel = new AgentPanel(page)
  await agentPanel.open()
  await agentPanel.selectWorkflow()
  await agentPanel.sendMessage('hello')
  hostSocket.send({
    type: 'agent_message_done',
    data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
  })
  await hostSocket.waitForSubscribe()

  const vueNodes = new VueNodeHelpers(page)
  await expect(vueNodes.getNodeLocator(String(NODE_ID))).toBeVisible()
  return { host, hostSocket, vueNodes }
}

test.describe(
  'Agent CRDT: an ephemeral progress widget is never minted outbound',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('streaming execution progress mints nothing and never tells the user an edit was rejected', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { hostSocket } = await bootBoundToHost(page)

      // Execution streams progress text, three ticks of it, as a running node
      // does. Each tick writes `$$node-text-preview` through its real setter.
      for (const text of [PROGRESS_TEXT, LATER_PROGRESS_TEXT, 'Status: Done']) {
        hostSocket.sendExecutionBinary(progressTextFrame(String(NODE_ID), text))
        await nextFrame(page)
      }

      // The widget really was written, so this test cannot pass by never
      // exercising the path at all.
      await expect
        .poll(() => widgetValue(page, PREVIEW_WIDGET))
        .toBe('Status: Done')

      // Nothing about it reached the host, so the applier had nothing to
      // refuse. Before the fix every tick produced an `unknown_widget`.
      expect(hostSocket.humanOpOutcomes()).toEqual([])

      // And the human was never told that an edit they did not make was
      // refused and undone.
      const rejectionToast = new ToastHelper(page).toastErrors.filter({
        hasText: 'Widget edit was rejected and was not saved'
      })
      await expect(rejectionToast).toHaveCount(0)
    })

    test('a hand edit minted in the same tick as a progress write survives the batch', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { host, hostSocket, vueNodes } = await bootBoundToHost(page)

      // Execution creates the ephemeral widget on its first progress frame,
      // so the tick under test has one to write.
      hostSocket.sendExecutionBinary(
        progressTextFrame(String(NODE_ID), PROGRESS_TEXT)
      )
      await expect
        .poll(() => widgetValue(page, PREVIEW_WIDGET))
        .toBe(PROGRESS_TEXT)

      // ONE tick: progress text streams into the ephemeral widget while the
      // user's own `seed` edit commits. The minter collects a tick's intents
      // synchronously and `opSender` sends them as a single batch, with the
      // ephemeral write leading it.
      await page.evaluate(
        ({ nodeId, seed, preview, text }) => {
          const node = window.app!.graph.nodes.find(
            (candidate) => String(candidate.id) === nodeId
          )!
          node.widgets!.find((widget) => widget.name === preview)!.value = text
          node.widgets!.find((widget) => widget.name === 'seed')!.value = seed
        },
        {
          nodeId: String(NODE_ID),
          seed: EDITED_SEED_VALUE,
          preview: PREVIEW_WIDGET,
          text: LATER_PROGRESS_TEXT
        }
      )

      // The applier saw exactly the hand edit, and took it.
      await expect
        .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
        .toEqual(['applied'])

      // It landed in the shared document, rather than merely surviving on a
      // canvas the document disagrees with.
      expect(
        host.projection().nodes.find((node) => node.id === NODE_ID)
          ?.widgets_values
      ).toEqual([EDITED_SEED_VALUE, 20])

      // And the value the user typed is still the one on screen — not
      // reverted as collateral of an op they never made.
      const seedField = vueNodes
        .getNodeLocator(String(NODE_ID))
        .getByLabel('seed', { exact: true })
        .getByRole('spinbutton')
      await expect(seedField).toHaveValue(String(EDITED_SEED_VALUE))
    })
  }
)
