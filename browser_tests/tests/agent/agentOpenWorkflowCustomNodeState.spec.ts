import { expect, mergeTests } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

/**
 * PM-2018 (https://linear.app/comfyorg/issue/PM-2018): a VideoHelperSuite
 * workflow that ran fine stopped working after the Agent loaded it — the Load
 * Video node turned red and no final video was produced. Reproduced on
 * comfy-agent 0.1.0rc2 with ComfyUI master and frontend 1.59.0 on Linux. The
 * doc host stores the saved workflow faithfully; the canvas loses it while the
 * live-graph applier materializes the document into the opened tab:
 *
 * 1. VHS appends its per-format widgets as input slots whose `type` is the
 *    combo's option list (`["yuv420p", "yuv420p10le"]`). The document keeps
 *    that verbatim, but the applier's slot schema accepts only a string or
 *    number, reports `agent_graph_node_malformed`, and never creates the node.
 *    The dropped node is Video Combine, the workflow's only output.
 * 2. VHS saves `widgets_values` as a name-keyed record. The doc host's mint
 *    (`quarantineDictWidgets`) stores such a record whole under the opaque
 *    widget key, and the applier only reads an opaque positional array, so the
 *    node is configured without its saved values.
 *
 * The node definitions and the saved workflow below are trimmed copies of what
 * ComfyUI-VideoHelperSuite 4d907bee registers and serializes. VHS's own
 * frontend script is not loaded here, so a minimal onConfigure stands in for its
 * restore contract (`useKVState` in web/js/VHS.core.js: apply a
 * name-keyed `widgets_values` by widget name). The hand-load control proves the
 * fixture restores both nodes and their values without the Agent.
 */

const WORKFLOW_ID = 'b7c1d2e3-0000-4000-8000-000000002018'
const MESSAGE_ID = 'b7c1d2e3-0000-4000-8000-000000002019'
const THREAD_ID = 'b7c1d2e3-0000-4000-8000-000000002020'

const LOAD_ID = 1
const INVERT_ID = 2
const COMBINE_ID = 3
const SAVED_FRAME_LOAD_CAP = 8
const SAVED_FILENAME_PREFIX = 'pm2018_baseline'

const nodeDefs: Record<string, ComfyNodeDef> = {
  VHS_LoadVideo: {
    name: 'VHS_LoadVideo',
    display_name: 'Load Video (Upload)',
    description: '',
    category: 'Video Helper Suite',
    python_module: 'custom_nodes.ComfyUI-VideoHelperSuite',
    output_node: false,
    input: {
      required: {
        video: [['clip.mp4']],
        force_rate: ['FLOAT', { default: 0, min: 0, max: 60, step: 1 }],
        frame_load_cap: ['INT', { default: 0, min: 0, max: 100000, step: 1 }]
      }
    },
    output: ['IMAGE', 'INT'],
    output_is_list: [false, false],
    output_name: ['IMAGE', 'frame_count']
  },
  ImageInvert: {
    name: 'ImageInvert',
    display_name: 'Invert Image Colors',
    description: '',
    category: 'image',
    python_module: 'nodes',
    output_node: false,
    input: { required: { image: ['IMAGE'] } },
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE']
  },
  VHS_VideoCombine: {
    name: 'VHS_VideoCombine',
    display_name: 'Video Combine',
    description: '',
    category: 'Video Helper Suite',
    python_module: 'custom_nodes.ComfyUI-VideoHelperSuite',
    output_node: true,
    input: {
      required: {
        images: ['IMAGE'],
        frame_rate: ['FLOAT', { default: 8, min: 1, step: 1 }],
        filename_prefix: ['STRING', { default: 'AnimateDiff' }],
        format: [['image/gif', 'video/h264-mp4']]
      }
    },
    output: ['VHS_FILENAMES'],
    output_is_list: [false],
    output_name: ['Filenames']
  }
}

/** The shape VHS saves: name-keyed values and list-typed format slots. */
function savedVhsWorkflow(): ComfyWorkflowJSON {
  return {
    last_node_id: COMBINE_ID,
    last_link_id: 2,
    nodes: [
      {
        id: LOAD_ID,
        type: 'VHS_LoadVideo',
        pos: [40, 120],
        size: [260, 200],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [
          {
            name: 'video',
            type: 'COMBO',
            widget: { name: 'video' },
            link: null
          },
          {
            name: 'force_rate',
            type: 'FLOAT',
            widget: { name: 'force_rate' },
            link: null
          },
          {
            name: 'frame_load_cap',
            type: 'INT',
            widget: { name: 'frame_load_cap' },
            link: null
          }
        ],
        outputs: [
          { name: 'IMAGE', type: 'IMAGE', links: [1] },
          { name: 'frame_count', type: 'INT', links: null }
        ],
        properties: { 'Node name for S&R': 'VHS_LoadVideo' },
        widgets_values: {
          video: 'clip.mp4',
          force_rate: 0,
          frame_load_cap: SAVED_FRAME_LOAD_CAP
        }
      },
      {
        id: INVERT_ID,
        type: 'ImageInvert',
        pos: [360, 120],
        size: [200, 60],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [{ name: 'image', type: 'IMAGE', link: 1 }],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [2] }],
        properties: { 'Node name for S&R': 'ImageInvert' }
      },
      {
        id: COMBINE_ID,
        type: 'VHS_VideoCombine',
        pos: [620, 120],
        size: [260, 220],
        flags: {},
        order: 2,
        mode: 0,
        inputs: [
          { name: 'images', type: 'IMAGE', link: 2 },
          {
            name: 'frame_rate',
            type: 'FLOAT',
            widget: { name: 'frame_rate' },
            link: null
          },
          {
            name: 'filename_prefix',
            type: 'STRING',
            widget: { name: 'filename_prefix' },
            link: null
          },
          {
            name: 'format',
            type: 'COMBO',
            widget: { name: 'format' },
            link: null
          },
          // Appended by VHS for the selected format; `type` is the option list.
          {
            name: 'pix_fmt',
            type: ['yuv420p', 'yuv420p10le'],
            widget: { name: 'pix_fmt' },
            link: null
          }
        ],
        outputs: [{ name: 'Filenames', type: 'VHS_FILENAMES', links: null }],
        properties: { 'Node name for S&R': 'VHS_VideoCombine' },
        widgets_values: {
          frame_rate: 8,
          filename_prefix: SAVED_FILENAME_PREFIX,
          format: 'video/h264-mp4',
          pix_fmt: 'yuv420p'
        }
      }
    ],
    links: [
      [1, LOAD_ID, 0, INVERT_ID, 0, 'IMAGE'],
      [2, INVERT_ID, 0, COMBINE_ID, 0, 'IMAGE']
    ],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as unknown as ComfyWorkflowJSON
}

// Neither VHS class is in the pinned catalog, as on a local install.
const catalog: WidgetCatalog = { types: { ImageInvert: { widget_order: [] } } }

/** Stand-in for VHS's `useKVState`: restore a name-keyed `widgets_values`. */
async function registerKvStateRestore(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const type of ['VHS_LoadVideo', 'VHS_VideoCombine']) {
      const proto = window.LiteGraph!.registered_node_types[type].prototype
      const original = proto.onConfigure
      proto.onConfigure = function (info) {
        original?.call(this, info)
        const saved = info.widgets_values as unknown
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        for (const widget of this.widgets ?? []) {
          if (Object.hasOwn(saved, widget.name))
            widget.value = (saved as Record<string, never>)[widget.name]
        }
      }
    }
  })
}

interface CanvasState {
  types: string[]
  frameLoadCap: unknown
  filenamePrefix: unknown
}

function canvasState(page: Page): Promise<CanvasState> {
  return page.evaluate(
    ([loadId, combineId]) => {
      const graph = window.app!.graph
      const widget = (id: number, name: string) =>
        graph.nodes
          .find((node) => String(node.id) === String(id))
          ?.widgets?.find((w) => w.name === name)?.value
      return {
        types: graph.nodes.map((node) => node.type).sort(),
        frameLoadCap: widget(loadId, 'frame_load_cap'),
        filenamePrefix: widget(combineId, 'filename_prefix')
      }
    },
    [LOAD_ID, COMBINE_ID] as const
  )
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  })
  await bootAgentApp(page, true, {
    objectInfo: nodeDefs,
    beforeNavigate: async (page) => {
      await mockAgentTurnApi(page, {
        message_id: MESSAGE_ID,
        thread_id: THREAD_ID,
        workflow_id: WORKFLOW_ID
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
    }
  })
  await registerKvStateRestore(page)
}

const RESTORED: CanvasState = {
  types: ['ImageInvert', 'VHS_LoadVideo', 'VHS_VideoCombine'],
  frameLoadCap: SAVED_FRAME_LOAD_CAP,
  filenamePrefix: SAVED_FILENAME_PREFIX
}

test.describe(
  'A saved custom-node workflow opened by the Agent (PM-2018)',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('control: loading the saved workflow by hand restores every node and its saved values', async ({
      page
    }) => {
      await boot(page)
      await loadIntoBootWorkflow(page, savedVhsWorkflow())
      await expect.poll(() => canvasState(page)).toEqual(RESTORED)
    })

    test('the canvas keeps the output node and the saved widget values', async ({
      page,
      getAgentSocket
    }) => {
      await boot(page)
      await loadIntoBootWorkflow(page, BLANK_WORKFLOW)

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const socket: WebSocketRoute = await getAgentSocket()
      const outbound: string[] = []
      socket.onMessage((message) => outbound.push(String(message)))
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Load my saved VHS workflow.')
      await expect
        .poll(() => outbound, { timeout: 15_000 })
        .toContainEqual(expect.stringContaining('doc_subscribe'))

      // The document the Agent's open_workflow mints from the saved file.
      const host = new HostDoc(
        WORKFLOW_ID,
        savedVhsWorkflow() as unknown as WorkflowJSON,
        catalog
      )
      host.quarantineRecordWidgets(LOAD_ID)
      host.quarantineRecordWidgets(COMBINE_ID)
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

      // The applier ran: the node without custom state is on the canvas.
      await expect
        .poll(() => canvasState(page).then((state) => state.types))
        .toContain('ImageInvert')
      await page.screenshot({
        path: test.info().outputPath('agent-opened-vhs-workflow.png')
      })

      test.fail(
        true,
        'PM-2018: the applier drops a node with a list-typed slot and ignores name-keyed opaque widget values'
      )
      await expect
        .poll(() => canvasState(page), { timeout: 5_000 })
        .toEqual(RESTORED)
    })
  }
)
