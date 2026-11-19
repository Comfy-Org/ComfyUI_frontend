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
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
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
import MARKER_WORKFLOW_ASSET from '@e2e/assets/agent/embedded-workflow-marker.json' with { type: 'json' }
import { createWorkflowBearingPng } from '@e2e/fixtures/data/agent/workflowBearingPng'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const CURRENT_WORKFLOW_ID = '5e7f8a9b-2c3d-44e6-97f8-9a0b1c2d3e4f'
const IMPORTED_WORKFLOW_ID = '9b8c7d6e-5f40-4321-8b9c-6d7e5f403b1c'
const THREAD_ID = '3d4e5f60-7a8b-4901-9d0e-1f2a3b4c5d6e'
const MESSAGE_ID = '8f7e6d5c-4b3a-4210-9f8e-7d6c5b4a3f20'
const IMAGE_NAME = 'portrait.png'
const DERIVED_NAME = 'portrait.workflow.json'
const IMPORTED_NAME = 'portrait-workflow'
const UPLOADED_IMAGE_REF = 'assets/portrait.png'
const UPLOADED_WORKFLOW_REF = 'assets/portrait.workflow.json'
const MARKER_TYPE = 'EmbeddedWorkflowMarker'
const CURRENT_CANVAS_TITLE = 'Current canvas sentinel'
const EMBEDDED_WORKFLOW_TITLE = 'Embedded workflow source'
const IMPORTED_RESULT_TITLE = 'Imported workflow result'
const CURRENT_CANVAS_NODE_ID = 12
const EMBEDDED_WORKFLOW_NODE_ID = 42
const IMPORTED_RESULT_NODE_ID = 72
const USER_REQUEST =
  'Change the workflow inside this image and open the result.'

const NODE_DEFINITIONS: Record<string, ComfyNodeDef> = {
  [MARKER_TYPE]: {
    name: MARKER_TYPE,
    display_name: 'Embedded Workflow Marker',
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
  const asset = zComfyWorkflow.parse(MARKER_WORKFLOW_ASSET)
  return {
    ...asset,
    last_node_id: id,
    extra: asset.extra ?? undefined,
    nodes: asset.nodes.map((node) => ({ ...node, id, title }))
  }
}

const CURRENT_WORKFLOW = markerWorkflow(
  CURRENT_CANVAS_NODE_ID,
  CURRENT_CANVAS_TITLE
)
const EMBEDDED_WORKFLOW = markerWorkflow(
  EMBEDDED_WORKFLOW_NODE_ID,
  EMBEDDED_WORKFLOW_TITLE
)
const IMPORTED_RESULT = markerWorkflow(
  IMPORTED_RESULT_NODE_ID,
  IMPORTED_RESULT_TITLE
)

const ATTACHED_IMAGE = createWorkflowBearingPng({ workflow: EMBEDDED_WORKFLOW })

interface UploadedFile {
  filename: string
  text: string
}

async function uploadedFile(request: Request): Promise<UploadedFile> {
  const body = request.postDataBuffer()
  if (!body) throw new Error('The attachment upload has no body')
  const form = await new Response(new Uint8Array(body), {
    headers: { 'content-type': request.headers()['content-type'] ?? '' }
  }).formData()
  const file = form.get('image')
  if (!(file instanceof File))
    throw new Error('The attachment upload has no image file')
  return { filename: file.name, text: await file.text() }
}

function hasEmbeddedWorkflowMarker(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('nodes' in value))
    return false
  if (!Array.isArray(value.nodes)) return false
  return value.nodes.some(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      'id' in node &&
      node.id === EMBEDDED_WORKFLOW_NODE_ID &&
      'type' in node &&
      node.type === MARKER_TYPE &&
      'title' in node &&
      node.title === EMBEDDED_WORKFLOW_TITLE
  )
}

class AgentEmbeddedWorkflowAttachmentFixture {
  public readonly activeCanvasNode: Locator
  public readonly agentPanel: AgentPanel
  public readonly derivedName = DERIVED_NAME
  public readonly embeddedSourceNode: Locator
  public readonly imageName = IMAGE_NAME
  public readonly importedName = IMPORTED_NAME
  public readonly importedResultNode: Locator
  public readonly topbar: Topbar
  public readonly userRequest = USER_REQUEST

  public readonly expectedRequest: Pick<
    AgentPostMessageRequest,
    'workflow_id' | 'attachments'
  > = {
    workflow_id: CURRENT_WORKFLOW_ID,
    attachments: [UPLOADED_IMAGE_REF, UPLOADED_WORKFLOW_REF]
  }

  private readonly hostSocket: AgentFollowerHostSocket
  private readonly uploads: UploadedFile[] = []
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
    this.embeddedSourceNode = vueNodes
      .getNodeLocator(String(EMBEDDED_WORKFLOW_NODE_ID))
      .and(vueNodes.getNodeByTitle(EMBEDDED_WORKFLOW_TITLE))
    this.importedResultNode = vueNodes
      .getNodeLocator(String(IMPORTED_RESULT_NODE_ID))
      .and(vueNodes.getNodeByTitle(IMPORTED_RESULT_TITLE))
    this.agentPanel = new AgentPanel(page)
    this.topbar = new Topbar(page)
  }

  async setup(agentFlagEnabled: boolean): Promise<void> {
    const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
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
      const file = await uploadedFile(route.request())
      this.uploads.push(file)
      const isDerived = file.filename.endsWith('.workflow.json')
      const upload: UploadImageResponse = {
        name: isDerived ? UPLOADED_WORKFLOW_REF : UPLOADED_IMAGE_REF,
        subfolder: '',
        type: 'input'
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

  async attachImage(): Promise<void> {
    await this.agentPanel.open()
    await this.agentPanel.selectWorkflow()
    await this.agentPanel.fileInput.setInputFiles({
      name: IMAGE_NAME,
      mimeType: 'image/png',
      buffer: ATTACHED_IMAGE
    })
  }

  async liftedWorkflow(): Promise<unknown> {
    await expect
      .poll(() => this.uploads.some((file) => file.filename === DERIVED_NAME))
      .toBe(true)
    const derived = this.uploads.find((file) => file.filename === DERIVED_NAME)
    if (!derived) throw new Error('No derived workflow was uploaded')
    return JSON.parse(derived.text)
  }

  async liftedWorkflowHasMarker(): Promise<boolean> {
    return hasEmbeddedWorkflowMarker(await this.liftedWorkflow())
  }

  uploadedNames(): string[] {
    return this.uploads.map((file) => file.filename)
  }

  async sendTurn(): Promise<void> {
    await this.agentPanel.sendMessage(USER_REQUEST)
  }

  async postedTurn(): Promise<AgentPostMessageRequest> {
    await expect.poll(() => this.postedTurnValue).toBeDefined()
    if (this.postedTurnValue === undefined)
      throw new Error('The turn was not posted')
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

export const agentEmbeddedWorkflowAttachmentTest = agentTest.extend<{
  embeddedWorkflowAttachment: AgentEmbeddedWorkflowAttachmentFixture
}>({
  embeddedWorkflowAttachment: async ({ page, agentFlagEnabled }, use) => {
    const fixture = new AgentEmbeddedWorkflowAttachmentFixture(page)
    await fixture.setup(agentFlagEnabled)
    await use(fixture)
  }
})
