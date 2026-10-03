import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { AgentNonValueWidgetRig } from '@e2e/fixtures/agentNonValueWidgetRig'
import type { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'

/**
 * `preview_text` reaches the minter through an `executed` frame, the node's
 * `onExecuted` hook, and its store-backed setter rather than the binary
 * `progress_text` path exercised by the sibling spec.
 */

const PREVIEW_TYPE = 'PreviewAny'
const PREVIEW_NODE_ID = 611
const SAMPLER_TYPE = 'KSampler'
const SAMPLER_NODE_ID = 612
const WORKFLOW_ID = 'd5f3e6c4-0000-4000-8000-000000000070'
const MESSAGE_ID = 'd5f3e6c4-0000-4000-8000-000000000071'
const THREAD_ID = 'd5f3e6c4-0000-4000-8000-000000000072'
const SOCKET_SID = 'd5f3e6c4-0000-4000-8000-000000000073'
const JOB_ID = 'd5f3e6c4-0000-4000-8000-000000000074'

const PREVIEW_WIDGET = 'preview_text'
const SEED_VALUE = 333333
const EDITED_SEED_VALUE = 444444

/**
 * `PreviewAny` as the backend declares it: one wildcard LINK input and no
 * widget inputs at all. That is what makes the host's available-name list
 * empty, and it is why `preview_text` can only ever be `unknown_widget`.
 */
const previewNodeDef: ComfyNodeDef = {
  name: PREVIEW_TYPE,
  display_name: 'Preview Any',
  description: '',
  category: 'utils',
  python_module: 'nodes',
  output_node: true,
  input: { required: { source: ['*', {}] } },
  output: [],
  output_is_list: [],
  output_name: []
}

const samplerNodeDef: ComfyNodeDef = {
  name: SAMPLER_TYPE,
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
  types: {
    [PREVIEW_TYPE]: { widget_order: [] },
    [SAMPLER_TYPE]: { widget_order: ['seed', 'steps'] }
  }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: PREVIEW_NODE_ID,
      type: PREVIEW_TYPE,
      pos: [0, 0],
      size: [270, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [{ name: 'source', type: '*', link: null }],
      outputs: [],
      properties: {},
      widgets_values: []
    },
    {
      id: SAMPLER_NODE_ID,
      type: SAMPLER_TYPE,
      pos: [0, 220],
      size: [270, 140],
      flags: {},
      order: 1,
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

const rigConfig = {
  catalog,
  messageId: MESSAGE_ID,
  nodeDefs: {
    [PREVIEW_TYPE]: previewNodeDef,
    [SAMPLER_TYPE]: samplerNodeDef
  },
  samplerNodeId: SAMPLER_NODE_ID,
  seed,
  socketSid: SOCKET_SID,
  threadId: THREAD_ID,
  visibleNodeId: PREVIEW_NODE_ID,
  workflowId: WORKFLOW_ID
}

function sendTextOutput(
  hostSocket: AgentFollowerHostSocket,
  text: string
): void {
  hostSocket.sendExecution({
    type: 'executed',
    data: {
      prompt_id: JOB_ID,
      node: String(PREVIEW_NODE_ID),
      display_node: String(PREVIEW_NODE_ID),
      output: { text: [text] }
    }
  })
}

test.describe(
  'Agent CRDT: a PreviewAny text-preview widget is never minted outbound',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('execution text output mints nothing and never tells the user an edit was rejected', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const rig = await AgentNonValueWidgetRig.boot(page, rigConfig)
      const { hostSocket } = rig

      await test.step('stream a text output into the preview widget', async () => {
        sendTextOutput(hostSocket, 'tensor([1, 2, 3])')

        // The widget really was written, so this test cannot pass by never
        // exercising the path at all.
        await expect
          .poll(() => rig.widgetValue(PREVIEW_NODE_ID, PREVIEW_WIDGET))
          .toBe('tensor([1, 2, 3])')
      })

      await test.step('commit a hand edit as the settlement barrier', async () => {
        // `opSender` sends batches in order and the host judges them in
        // order, so once this edit's verdict is in, anything the preview
        // write minted ahead of it has already been judged and is already
        // in `humanOpOutcomes()`.
        await rig.editSeed(EDITED_SEED_VALUE)
      })

      await test.step('only the hand edit reached the applier', async () => {
        await expect
          .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
          .toEqual(['applied'])

        sendTextOutput(hostSocket, 'settled after result')
        await expect
          .poll(() => rig.widgetValue(PREVIEW_NODE_ID, PREVIEW_WIDGET))
          .toBe('settled after result')
      })

      await test.step('no rejection toast, hand edit still on screen', async () => {
        const rejectionToast = new ToastHelper(page).toastErrors.filter({
          hasText: 'Widget edit was rejected and was not saved'
        })
        await expect(rejectionToast).toHaveCount(0)
        await expect(rig.seedField()).toHaveValue(String(EDITED_SEED_VALUE))
      })
    })
  }
)
