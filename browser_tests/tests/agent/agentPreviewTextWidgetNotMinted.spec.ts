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
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/**
 * FE-3161 sub-cause C2, as production actually emits it.
 *
 * The sibling spec `agentProgressTextWidgetNotMinted.spec.ts` covers
 * `$$node-text-preview`, the widget the ticket was filed on. Every
 * `unknown_widget` rejection in the live `cloud-frontend-prod` sample on
 * 2026-10-02 names a *different* widget on a different code path:
 * `preview_text` on `PreviewAny`, with the doc host reporting
 * `available: (none — all inputs are links)`. Same family, same fix, but
 * nothing proved it.
 *
 * The two paths differ in how the write arrives, which is why one spec does
 * not stand in for the other:
 *
 * - `$$node-text-preview` is injected by `useNodeProgressText` and driven by
 *   BINARY `progress_text` frames.
 * - `preview_text` is a `ComponentWidgetImpl` added by
 *   `addTextPreviewWidgets` at `onNodeCreated`, and driven by the JSON
 *   `executed` frame through the node's own `onExecuted` hook. Its value
 *   setter writes `widgetValueStore` state directly
 *   (`textPreviewWidgets.ts:46-50`), so the `set_widget` intent is raised from
 *   the store rather than from a litegraph widget assignment.
 *
 * Both carry `serialize: false`, so the minter's value-widget predicate is the
 * one fix for both. `PreviewAny` additionally has no serializable widgets at
 * all, so its catalog entry is empty and the host can only answer
 * `unknown_widget` — exactly the production message.
 *
 * Runs against a REAL host: `AgentFollowerHostSocket` in `apply` mode judges
 * every client batch with the real `comfy-multi-player` applier, so the
 * rejection is the library's verdict and not a hand-written frame.
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

interface Rig {
  host: HostDoc
  hostSocket: AgentFollowerHostSocket
  vueNodes: VueNodeHelpers
}

/** The live value of one widget on a node. */
function widgetValue(
  page: Page,
  nodeId: number,
  name: string
): Promise<unknown> {
  return page.evaluate(
    ({ nodeId, name }) =>
      window
        .app!.graph.nodes.find((node) => String(node.id) === nodeId)
        ?.widgets?.find((widget) => widget.name === name)?.value,
    { nodeId: String(nodeId), name }
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
    objectInfo: {
      [PREVIEW_TYPE]: previewNodeDef,
      [SAMPLER_TYPE]: samplerNodeDef
    },
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
  await expect(vueNodes.getNodeLocator(String(PREVIEW_NODE_ID))).toBeVisible()
  return { host, hostSocket, vueNodes }
}

/**
 * One real `executed` frame carrying text output, which is what drives
 * `PreviewAny.onExecuted` → `updateTextPreviewWidgets` → the preview widget's
 * value setter.
 */
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

/** Commits a hand edit on the sampler's real `seed` widget. */
function editSeed(page: Page, value: number): Promise<void> {
  return page.evaluate(
    ({ nodeId, value }) => {
      const node = window.app!.graph.nodes.find(
        (candidate) => String(candidate.id) === nodeId
      )!
      node.widgets!.find((widget) => widget.name === 'seed')!.value = value
    },
    { nodeId: String(SAMPLER_NODE_ID), value }
  )
}

/** The rendered `seed` input on the sampler. */
function seedField(vueNodes: VueNodeHelpers) {
  return vueNodes
    .getNodeLocator(String(SAMPLER_NODE_ID))
    .getByLabel('seed', { exact: true })
    .getByRole('spinbutton')
}

test.describe(
  'Agent CRDT: a PreviewAny text-preview widget is never minted outbound',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('execution text output mints nothing and never tells the user an edit was rejected', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { hostSocket, vueNodes } = await bootBoundToHost(page)

      // The node finishes and its text output streams into `preview_text`,
      // through the node's own `onExecuted` hook.
      sendTextOutput(hostSocket, 'tensor([1, 2, 3])')

      // The widget really was written, so this test cannot pass by never
      // exercising the path at all.
      await expect
        .poll(() => widgetValue(page, PREVIEW_NODE_ID, PREVIEW_WIDGET))
        .toBe('tensor([1, 2, 3])')

      // A hand edit committed after that write, in its own tick, is the
      // settlement barrier. `opSender` sends batches in order and the host
      // judges them in order, so once this edit's verdict is in, anything the
      // preview write minted ahead of it has already been judged and is
      // already in `humanOpOutcomes()`.
      await editSeed(page, EDITED_SEED_VALUE)

      // Exactly one op reached the applier: the hand edit. The preview write
      // minted nothing — before the fix it produced
      // `widget 'preview_text' not found on PreviewAny`, which would sit
      // ahead of `applied` here.
      await expect
        .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
        .toEqual(['applied'])

      // And the human was never told that an edit they did not make was
      // refused and undone.
      const rejectionToast = new ToastHelper(page).toastErrors.filter({
        hasText: 'Widget edit was rejected and was not saved'
      })
      await expect(rejectionToast).toHaveCount(0)

      // The hand edit is still the value on screen, not reverted as collateral.
      await expect(seedField(vueNodes)).toHaveValue(String(EDITED_SEED_VALUE))
    })

    test('a hand edit minted in the same tick as a text-output write survives the batch', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { host, hostSocket, vueNodes } = await bootBoundToHost(page)

      // Execution populates the preview once, so the tick under test has an
      // existing widget to overwrite rather than one to create.
      sendTextOutput(hostSocket, 'tensor([1, 2, 3])')
      await expect
        .poll(() => widgetValue(page, PREVIEW_NODE_ID, PREVIEW_WIDGET))
        .toBe('tensor([1, 2, 3])')

      // ONE tick: the preview write and the user's own `seed` edit commit
      // together. The minter collects a tick's intents synchronously and
      // `opSender` sends them as a single batch, with the preview write
      // leading it. `applyOps` is abort-remainder, so before the fix the
      // host refused the preview write as `unknown_widget`, the hand edit
      // behind it came back `batch_aborted`, and `revertRejectedOps` took the
      // user's value off the canvas with it.
      await page.evaluate(
        ({ previewNodeId, samplerNodeId, preview, text, seed }) => {
          const nodes = window.app!.graph.nodes
          const previewNode = nodes.find(
            (candidate) => String(candidate.id) === previewNodeId
          )!
          const samplerNode = nodes.find(
            (candidate) => String(candidate.id) === samplerNodeId
          )!
          previewNode.widgets!.find(
            (widget) => widget.name === preview
          )!.value = text
          samplerNode.widgets!.find((widget) => widget.name === 'seed')!.value =
            seed
        },
        {
          previewNodeId: String(PREVIEW_NODE_ID),
          samplerNodeId: String(SAMPLER_NODE_ID),
          preview: PREVIEW_WIDGET,
          text: 'tensor([4, 5, 6])',
          seed: EDITED_SEED_VALUE
        }
      )

      // The applier saw exactly the hand edit, and took it.
      await expect
        .poll(() => hostSocket.humanOpOutcomes().map((o) => o.outcome))
        .toEqual(['applied'])

      // It landed in the shared document, rather than merely surviving on a
      // canvas the document disagrees with.
      expect(
        host.projection().nodes.find((node) => node.id === SAMPLER_NODE_ID)
          ?.widgets_values
      ).toEqual([EDITED_SEED_VALUE, 20])

      // And the value the user typed is still the one on screen.
      await expect(seedField(vueNodes)).toHaveValue(String(EDITED_SEED_VALUE))
    })
  }
)
