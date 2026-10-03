import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { AgentNonValueWidgetRig } from '@e2e/fixtures/agentNonValueWidgetRig'
import type { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import { nextFrame } from '@e2e/fixtures/utils/timing'

/**
 * `$$node-text-preview` is a `serialize: false` widget written by binary
 * `progress_text` frames. The host judges each batch with the real applier.
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

const rigConfig = {
  catalog,
  messageId: MESSAGE_ID,
  nodeDefs: { [NODE_TYPE]: nodeDef },
  samplerNodeId: NODE_ID,
  seed,
  socketSid: SOCKET_SID,
  threadId: THREAD_ID,
  visibleNodeId: NODE_ID,
  workflowId: WORKFLOW_ID
}

/** One execution progress tick, through the widget's real setter. */
async function streamProgress(
  page: Page,
  hostSocket: AgentFollowerHostSocket,
  text: string
): Promise<void> {
  hostSocket.sendExecutionBinary(progressTextFrame(String(NODE_ID), text))
  await nextFrame(page)
}

test.describe(
  'Agent CRDT: an ephemeral progress widget is never minted outbound',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('streaming execution progress mints nothing and never tells the user an edit was rejected', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const rig = await AgentNonValueWidgetRig.boot(page, rigConfig)
      const { hostSocket } = rig

      await test.step('stream three progress ticks into the ephemeral widget', async () => {
        await streamProgress(page, hostSocket, PROGRESS_TEXT)
        await streamProgress(page, hostSocket, LATER_PROGRESS_TEXT)
        await streamProgress(page, hostSocket, 'Status: Done')

        // The widget really was written, so this test cannot pass by never
        // exercising the path at all.
        await expect
          .poll(() => rig.widgetValue(NODE_ID, PREVIEW_WIDGET))
          .toBe('Status: Done')
      })

      await test.step('commit a hand edit as the settlement barrier', async () => {
        // `opSender` sends batches in order and the host judges them in
        // order, so once this edit's verdict is in, anything the progress
        // writes minted ahead of it has already been judged and is already
        // in `humanOpOutcomes()`. That turns "nothing was minted" from a
        // negative assertion that passes while ops are still in flight into
        // a positive one on the whole collection.
        await rig.editSeed(EDITED_SEED_VALUE)
      })

      await test.step('only the hand edit reached the applier', async () => {
        await expect
          .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
          .toEqual(['applied'])

        await streamProgress(page, hostSocket, 'Status: Settled')
        await expect
          .poll(() => rig.widgetValue(NODE_ID, PREVIEW_WIDGET))
          .toBe('Status: Settled')
      })

      await test.step('no rejection toast, hand edit still on screen', async () => {
        const rejectionToast = new ToastHelper(page).toastErrors.filter({
          hasText: 'Widget edit was rejected and was not saved'
        })
        await expect(rejectionToast).toHaveCount(0)
        await expect(rig.seedField()).toHaveValue(String(EDITED_SEED_VALUE))
      })
    })

    test('a hand edit minted in the same tick as a progress write survives the batch', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const rig = await AgentNonValueWidgetRig.boot(page, rigConfig)
      const { host, hostSocket } = rig

      await test.step('create the ephemeral widget via a progress frame', async () => {
        hostSocket.sendExecutionBinary(
          progressTextFrame(String(NODE_ID), PROGRESS_TEXT)
        )
        await expect
          .poll(() => rig.widgetValue(NODE_ID, PREVIEW_WIDGET))
          .toBe(PROGRESS_TEXT)
      })

      await test.step('write the ephemeral widget and the hand edit in one tick', async () => {
        // The minter collects a tick's intents synchronously and `opSender`
        // sends them as a single batch, with the ephemeral write leading it.
        await page.evaluate(
          ({ nodeId, seed, preview, text }) => {
            const node = window.app!.graph.nodes.find(
              (candidate) => String(candidate.id) === nodeId
            )
            const previewWidget = node?.widgets?.find(
              (widget) => widget.name === preview
            )
            const seedWidget = node?.widgets?.find(
              (widget) => widget.name === 'seed'
            )
            if (!previewWidget) {
              throw new Error(`Expected ${preview} on node ${nodeId}`)
            }
            if (!seedWidget) {
              throw new Error(`Expected a seed widget on node ${nodeId}`)
            }
            previewWidget.value = text
            seedWidget.value = seed
          },
          {
            nodeId: String(NODE_ID),
            seed: EDITED_SEED_VALUE,
            preview: PREVIEW_WIDGET,
            text: LATER_PROGRESS_TEXT
          }
        )
      })

      await test.step('only the hand edit reached the applier and the document', async () => {
        await expect
          .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
          .toEqual(['applied'])

        expect(
          host.projection().nodes.find((node) => node.id === NODE_ID)
            ?.widgets_values
        ).toEqual([EDITED_SEED_VALUE, 20])
      })

      await test.step('the typed value is still on screen', async () => {
        await expect(rig.seedField()).toHaveValue(String(EDITED_SEED_VALUE))
      })
    })
  }
)
