import { expect } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'

import type {
  AgentPostMessageRequest,
  AgentRunMode,
  UploadImageResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import {
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const CURRENT_WORKFLOW_ID = '4d6f7e8a-1b2c-43d5-96e7-8f9a0b1c2d3e'
const IMPORTED_WORKFLOW_ID = '8a7b6c5d-4e3f-4210-9a8b-7c6d5e4f3a2b'
const THREAD_ID = '2c3d4e5f-6a7b-4890-8c9d-0e1f2a3b4c5d'
const MESSAGE_ID = '7e6d5c4b-3a2f-4109-8e7d-6c5b4a3f2e1d'
const IMPORTED_NAME = 'portrait-workflow'
const UPLOADED_REF = 'assets/portrait-workflow.json'
const MARKER_TYPE = 'AttachedWorkflowMarker'
const CURRENT_CANVAS_TITLE = 'Current canvas sentinel'
const ATTACHED_WORKFLOW_TITLE = 'Attached workflow source'
const IMPORTED_RESULT_TITLE = 'Imported workflow result'
const CURRENT_CANVAS_NODE_ID = 11
const ATTACHED_WORKFLOW_NODE_ID = 41
const IMPORTED_RESULT_NODE_ID = 71
const USER_REQUEST = 'Change the attached workflow and open the result.'

const NODE_DEFINITIONS: Record<string, ComfyNodeDef> = {
  [MARKER_TYPE]: {
    name: MARKER_TYPE,
    display_name: 'Attached Workflow Marker',
    description: '',
    category: 'testing',
    python_module: 'testing',
    output_node: false,
    input: { required: {} },
    output: [],
    output_is_list: [],
    output_name: []
  }
}

function markerWorkflow(
  id: number,
  title: string
): WorkflowJSON & ComfyWorkflowJSON {
  return {
    last_node_id: id,
    last_link_id: 0,
    nodes: [
      {
        id,
        type: MARKER_TYPE,
        title,
        pos: [320, 240],
        size: [260, 60],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [],
        properties: {}
      }
    ],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

const CURRENT_WORKFLOW = markerWorkflow(
  CURRENT_CANVAS_NODE_ID,
  CURRENT_CANVAS_TITLE
)
const ATTACHED_WORKFLOW = markerWorkflow(
  ATTACHED_WORKFLOW_NODE_ID,
  ATTACHED_WORKFLOW_TITLE
)
const IMPORTED_RESULT = markerWorkflow(
  IMPORTED_RESULT_NODE_ID,
  IMPORTED_RESULT_TITLE
)

async function uploadedWorkflow(request: Request): Promise<unknown> {
  const body = request.postDataBuffer()
  if (!body) throw new Error('The attached-workflow upload has no body')
  const form = await new Response(new Uint8Array(body), {
    headers: { 'content-type': request.headers()['content-type'] ?? '' }
  }).formData()
  const file = form.get('image')
  if (!(file instanceof File))
    throw new Error('The attached-workflow upload has no image file')
  return JSON.parse(await file.text())
}

function hasAttachedWorkflowMarker(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('nodes' in value))
    return false
  if (!Array.isArray(value.nodes)) return false
  return value.nodes.some(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      'id' in node &&
      node.id === ATTACHED_WORKFLOW_NODE_ID &&
      'type' in node &&
      node.type === MARKER_TYPE &&
      'title' in node &&
      node.title === ATTACHED_WORKFLOW_TITLE
  )
}

class AgentAttachedWorkflowImportFixture {
  public readonly activeCanvasNode: Locator
  public readonly agentPanel: AgentPanel
  public readonly attachedSourceNode: Locator
  public readonly attachmentName = `${IMPORTED_NAME}.json`
  public readonly expectedRequest: Pick<
    AgentPostMessageRequest,
    'workflow_id' | 'attachments'
  > = {
    workflow_id: CURRENT_WORKFLOW_ID,
    attachments: [UPLOADED_REF]
  }
  public readonly importedName = IMPORTED_NAME
  public readonly importedResultNode: Locator
  public readonly topbar: Topbar
  public readonly userRequest = USER_REQUEST

  private readonly hostSocket: AgentFollowerHostSocket
  private postedTurnValue: AgentPostMessageRequest | Error | undefined

  constructor(private readonly page: Page) {
    const host = new HostDoc(IMPORTED_WORKFLOW_ID, IMPORTED_RESULT, {
      types: {}
    })
    this.hostSocket = new AgentFollowerHostSocket(
      page,
      IMPORTED_WORKFLOW_ID,
      host
    )
    const vueNodes = new VueNodeHelpers(page)
    this.activeCanvasNode = vueNodes
      .getNodeLocator(String(CURRENT_CANVAS_NODE_ID))
      .and(vueNodes.getNodeByTitle(CURRENT_CANVAS_TITLE))
    this.attachedSourceNode = vueNodes
      .getNodeLocator(String(ATTACHED_WORKFLOW_NODE_ID))
      .and(vueNodes.getNodeByTitle(ATTACHED_WORKFLOW_TITLE))
    this.importedResultNode = vueNodes
      .getNodeLocator(String(IMPORTED_RESULT_NODE_ID))
      .and(vueNodes.getNodeByTitle(IMPORTED_RESULT_TITLE))
    this.agentPanel = new AgentPanel(page)
    this.topbar = new Topbar(page)
  }

  async setup(agentFlagEnabled: boolean): Promise<void> {
    const upload: UploadImageResponse = {
      name: UPLOADED_REF,
      subfolder: '',
      type: 'input'
    }
    const runMode: AgentRunMode = {
      mode: 'ask_approval',
      credit_limit: null
    }
    const accepted: AgentTurnAccepted = {
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID,
      workflow_id: IMPORTED_WORKFLOW_ID
    }

    await this.hostSocket.install()
    await this.page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await this.page.route('**/api/agent/threads?*', (route) =>
      route.fulfill(jsonRoute(emptyAgentThreadList()))
    )
    await this.page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    await this.page.route('**/api/upload/image', async (route) => {
      const uploaded = await uploadedWorkflow(route.request())
      if (!hasAttachedWorkflowMarker(uploaded)) {
        return route.fulfill({
          ...jsonRoute({ error: 'Attached workflow marker missing' }),
          status: 422
        })
      }
      return route.fulfill(jsonRoute(upload))
    })
    await this.page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST')
        return route.fulfill(jsonRoute([]))
      const parsed = zAgentPostMessageRequest.safeParse(
        route.request().postDataJSON()
      )
      this.postedTurnValue = parsed.success
        ? parsed.data
        : new Error(parsed.error.message)
      return route.fulfill({ ...jsonRoute(accepted), status: 202 })
    })

    await bootAgentApp(this.page, agentFlagEnabled, {
      objectInfo: NODE_DEFINITIONS,
      vueNodes: true,
      beforeNavigate: async (page) => {
        await mockWorkflowPersistence(page, CURRENT_WORKFLOW_ID)
      }
    })
    await loadIntoBootWorkflow(this.page, CURRENT_WORKFLOW)
  }

  async attachWorkflow(): Promise<void> {
    await this.agentPanel.open()
    await this.agentPanel.selectWorkflow()
    await this.agentPanel.fileInput.setInputFiles({
      name: this.attachmentName,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(ATTACHED_WORKFLOW))
    })
  }

  async sendTurn(): Promise<void> {
    await this.agentPanel.sendMessage(USER_REQUEST)
  }

  async postedTurn(): Promise<AgentPostMessageRequest> {
    await expect.poll(() => this.postedTurnValue).toBeDefined()
    if (this.postedTurnValue === undefined)
      throw new Error('The attached-workflow turn was not posted')
    if (this.postedTurnValue instanceof Error) throw this.postedTurnValue
    return this.postedTurnValue
  }

  async openImportedResult(): Promise<void> {
    this.hostSocket.send({
      type: 'agent_active_tab',
      data: {
        workflow_id: IMPORTED_WORKFLOW_ID,
        name: IMPORTED_NAME,
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID
      }
    })
    this.hostSocket.send({
      type: 'agent_message_done',
      data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
    })
    await this.hostSocket.waitForSubscribe()
  }
}

export const agentAttachedWorkflowImportTest = agentTest.extend<{
  attachedWorkflowImport: AgentAttachedWorkflowImportFixture
}>({
  attachedWorkflowImport: async ({ page, agentFlagEnabled }, use) => {
    const fixture = new AgentAttachedWorkflowImportFixture(page)
    await fixture.setup(agentFlagEnabled)
    await use(fixture)
  }
})
