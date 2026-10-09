import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { AgentNonValueWidgetRig } from '@e2e/fixtures/agentNonValueWidgetRig'
import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'

/**
 * The sibling `agentProgressTextWidgetNotMinted` spec covers the ephemeral
 * widget while its own `serialize: false` is intact, which both the old and the
 * new precedence rule read correctly. This spec covers the one case they
 * disagree on: a live widget whose `serialize` key is PRESENT and `undefined`.
 *
 * `'serialize' in widget` is true for a present-but-undefined key, so the old
 * rule short-circuited to that `undefined`, skipped the store's registered
 * `serialize: false`, and minted a `set_widget` for a widget the document does
 * not carry. `widget?.serialize ?? stored?.serialize` treats absent and
 * present-but-undefined alike, which is what `IBaseWidget.serialize?: boolean`
 * already means.
 *
 * Carrier: frontend #20027.
 */

const NODE_TYPE = 'KSampler'
const NODE_ID = 711
const WORKFLOW_ID = 'e7a4c6d2-0000-4000-8000-000000000080'
const MESSAGE_ID = 'e7a4c6d2-0000-4000-8000-000000000081'
const THREAD_ID = 'e7a4c6d2-0000-4000-8000-000000000082'
const SOCKET_SID = 'e7a4c6d2-0000-4000-8000-000000000083'

const PREVIEW_WIDGET = '$$node-text-preview'
const SEED_VALUE = 777777
const EDITED_SEED_VALUE = 888888
const FIRST_PROGRESS_TEXT = 'Status: Running\nTime elapsed: 2s'
const LATER_PROGRESS_TEXT = 'Status: Running\nTime elapsed: 7s'
const STEPS_VALUE = 20

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
      steps: ['INT', { default: STEPS_VALUE, min: 1, max: 10000 }]
    }
  },
  output: ['LATENT'],
  output_is_list: [false],
  output_name: ['LATENT']
}

/**
 * The pinned catalog carries only the two value widgets, so an op naming
 * `$$node-text-preview` is a widget the applier has no entry for.
 */
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
      widgets_values: [SEED_VALUE, STEPS_VALUE]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
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

test.describe(
  'Agent CRDT: a widget whose live serialize flag is undefined is never minted outbound',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('an ephemeral widget that leaves serialize undefined mints nothing and never tells the user an edit was rejected', async ({
      page,
      toast
    }) => {
      test.setTimeout(60_000)
      const rig = await AgentNonValueWidgetRig.boot(page, rigConfig)
      const { host, hostSocket } = rig

      await test.step('create the ephemeral widget with its serialize flag intact', async () => {
        await rig.streamProgressText(NODE_ID, FIRST_PROGRESS_TEXT)
        await expect
          .poll(() => rig.widgetValue(NODE_ID, PREVIEW_WIDGET))
          .toBe(FIRST_PROGRESS_TEXT)
      })

      await test.step('leave the live flag present but undefined', async () => {
        // The store keeps the `serialize: false` it was registered with; only
        // the live widget stops stating it.
        await rig.clearLiveSerializeFlag(NODE_ID, PREVIEW_WIDGET)
      })

      await test.step('stream another tick through the widget', async () => {
        await rig.streamProgressText(NODE_ID, LATER_PROGRESS_TEXT)

        // The widget really was written, so this test cannot pass by never
        // exercising the command site at all.
        await expect
          .poll(() => rig.widgetValue(NODE_ID, PREVIEW_WIDGET))
          .toBe(LATER_PROGRESS_TEXT)
      })

      await test.step('commit a hand edit as the settlement barrier', async () => {
        // `opSender` sends batches in order and the host judges them in order,
        // so once this edit's verdict is in, anything the ephemeral write
        // minted ahead of it has already been judged and is already in
        // `humanOpOutcomes()`. That turns "nothing was minted" from a negative
        // assertion that passes while ops are still in flight into a positive
        // one on the whole collection.
        await rig.editSeed(EDITED_SEED_VALUE)
      })

      await test.step('only the hand edit reached the applier', async () => {
        await expect
          .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
          .toEqual(['applied'])
      })

      await test.step('the document carries the hand edit and no preview text', async () => {
        expect(
          host.projection().nodes.find((node) => node.id === NODE_ID)
            ?.widgets_values
        ).toEqual([EDITED_SEED_VALUE, STEPS_VALUE])
      })

      await test.step('no rejection toast, hand edit still on screen', async () => {
        const rejectionToast = toast.toastErrors.filter({
          hasText: 'Widget edit was rejected and was not saved'
        })
        await expect(rejectionToast).toHaveCount(0)
        await expect(rig.seedField()).toHaveValue(String(EDITED_SEED_VALUE))
      })
    })
  }
)
