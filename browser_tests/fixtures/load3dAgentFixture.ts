import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import load3dWorkflow from '@e2e/assets/3d/load3d_node.json' with { type: 'json' }
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'
import type { Page, Request } from '@playwright/test'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  zComfyApiWorkflow,
  zComfyWorkflow
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'
const SOCKET_SID = '5b0e2c9a-6f1d-4a83-9c27-3e4f5a6b7c8d'
const NODE_ID = '1'
const PANEL_MOUNT_TIMEOUT = 30_000

// The backend's Load3D definition, in `widgets_values` order; the host applier
// rejects a `set_widget` naming anything outside this list.
const LOAD3D_CATALOG: WidgetCatalog = {
  types: {
    Load3D: { widget_order: ['model_file', 'image', 'width', 'height'] },
    PreviewImage: { widget_order: [] }
  }
}

// The prompt names a capture as `threed/<upload name> [temp]`.
const PROMPT_IMAGE_REF = /^threed\/(.+) \[temp\]$/

/** Model files the fixture serves from `browser_tests/assets/3d`. */
type AgentModelFile = 'cube.obj' | 'workflow.glb'

const MODEL_ASSETS: Record<AgentModelFile, string> = {
  'cube.obj': 'cube.obj',
  'workflow.glb': 'animated_triangle.glb'
}

interface Load3dCapture {
  /** The `image` reference the queued prompt carried for the Load3D node. */
  promptImage: string
  /** The PNG the viewer uploaded under that reference. */
  imageBytes: Uint8Array
}

// The seed the host holds: the checked-in Load3D workflow with its widgets
// stored by name, so nothing here depends on positional order.
function seedWorkflow(): WorkflowJSON {
  const { extra, ...parsed } = zComfyWorkflow.parse(load3dWorkflow)
  const load3dNodes = parsed.nodes.map((node) => ({
    ...node,
    outputs: node.outputs?.map((output, index) => ({
      ...output,
      links: index === 0 ? [9] : output.links
    })),
    widgets_values: { model_file: '', width: 1024, height: 1024 }
  }))
  const nodes: WorkflowJSON['nodes'] = [
    ...load3dNodes,
    {
      id: 2,
      type: 'PreviewImage',
      pos: [500, 50],
      size: [260, 220],
      inputs: [{ name: 'images', type: 'IMAGE', link: 9 }],
      outputs: [],
      widgets_values: {}
    },
    {
      id: 3,
      type: 'PreviewImage',
      pos: [800, 50],
      size: [260, 220],
      inputs: [{ name: 'prompt', type: 'STRING', link: null }],
      outputs: [],
      widgets_values: {}
    }
  ]
  // The workflow schema allows `extra: null`; the multi-player seed does not.
  return {
    ...parsed,
    extra: extra ?? undefined,
    nodes,
    links: [[9, 1, 0, 2, 0, 'IMAGE']]
  }
}

function getQueuedPrompt(body: unknown): ComfyApiWorkflow {
  if (typeof body !== 'object' || body === null || !('prompt' in body))
    throw new Error('the queued prompt body carries no prompt object')
  return zComfyApiWorkflow.parse(body.prompt)
}

function promptImageRef(body: unknown): string {
  const image: unknown = Object.values(getQueuedPrompt(body)).find(
    (node) => node.inputs.image !== undefined
  )?.inputs.image
  const ref =
    typeof image === 'object' && image !== null && 'image' in image
      ? image.image
      : undefined
  if (typeof ref !== 'string')
    throw new Error('the queued prompt carries no Load3D image reference')
  return ref
}

async function uploadedImageBytes(request: Request): Promise<Uint8Array> {
  const body = request.postDataBuffer()
  if (!body) throw new Error('upload request has no body')
  const form = await new Response(new Uint8Array(body), {
    headers: { 'content-type': request.headers()['content-type'] ?? '' }
  }).formData()
  const image = form.get('image')
  if (!(image instanceof File)) throw new Error('upload has no image file')
  return new Uint8Array(await image.arrayBuffer())
}

/**
 * One Load3D node bound to an agent workflow, driven the way production is:
 * the panel opens the agent's tab, the follower subscribes over `/ws`, and the
 * fake host applies recorded `set_widget` ops that reach the node through the
 * doc frames the real client parses.
 */
class Load3dAgentHarness {
  readonly viewer: Load3DHelper

  private readonly host = new HostDoc(
    WORKFLOW_ID,
    seedWorkflow(),
    LOAD3D_CATALOG
  )
  private readonly hostSocket: AgentFollowerHostSocket
  private uploads = 0
  private readonly uploadsByName = new Map<string, Request>()

  constructor(private readonly page: Page) {
    this.hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      this.host,
      SOCKET_SID
    )
    this.viewer = new Load3DHelper(page.locator(`[data-node-id="${NODE_ID}"]`))
  }

  async boot(agentFlag: boolean): Promise<void> {
    await this.mockAgentApi()
    await this.mockLoad3dIo()
    await this.hostSocket.install()
    await bootAgentApp(this.page, agentFlag, {
      // Only the Vue node renderer projects follower edits onto the canvas.
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      },
      // The node materializes from the black-box backend's Load3D definition.
      objectInfo: 'server'
    })
    await this.page
      .getByRole('button', {
        name: enMessages.agent.entryButton,
        exact: true
      })
      .click()
    await expect(this.page.locator('#agent-panel-root')).toBeVisible({
      timeout: PANEL_MOUNT_TIMEOUT
    })
    // The agent announces its tab; the panel opens it and binds the follower.
    this.hostSocket.send({
      type: 'agent_active_tab',
      data: { workflow_id: WORKFLOW_ID, name: 'Load3D preview' }
    })
    await this.hostSocket.waitForSubscribe()
    await expect(this.viewer.node).toBeVisible()
    await expect(this.viewer.canvas).toBeVisible()
  }

  /**
   * The agent sets `model_file`; the value travels as a host doc frame. The
   * envelope (`op_id`, actor, version) is minted by the host, as on the wire.
   */
  setModelFromAgent(model: AgentModelFile): void {
    const widgets = this.host.graph().nodes[NODE_ID]?.widgets
    const old =
      typeof widgets === 'object' && widgets !== null
        ? (widgets as Record<string, unknown>)['model_file']
        : undefined
    const op: RecordedGraphOperation = {
      op: 'set_widget',
      node_id: NODE_ID,
      widget: 'model_file',
      old,
      value: model
    }
    this.hostSocket.send(this.host.apply([op]))
  }

  /** Waits until the node's `model_file` widget shows `model`. */
  async expectModel(model: AgentModelFile): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          (nodeId) =>
            window
              .app!.graph.getNodeById(nodeId)
              ?.widgets?.find((widget) => widget.name === 'model_file')?.value,
          toNodeId(NODE_ID)
        )
      )
      .toBe(model)
  }

  replaceLinkWithIncompatibleTarget(): void {
    this.hostSocket.send(this.host.replaceLink([9, 1, 0, 3, 0, 'STRING']))
  }

  async expectRenderedLinks(expected: unknown[]): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(() =>
          [...window.app!.graph.links.values()].map((link) => [
            link.id,
            link.origin_id,
            link.origin_slot,
            link.target_id,
            link.target_slot,
            link.type
          ])
        )
      )
      .toEqual(expected)
  }

  expectHostLink(expected: unknown): void {
    expect(this.host.link(9)).toEqual(expected)
  }

  /** Clicks Queue and resolves once the prompt for it has been posted. */
  private async queuePrompt(): Promise<unknown> {
    const posted = this.nextPrompt()
    await this.page.getByTestId(TestIds.topbar.queueButton).click()
    return posted
  }

  private async nextPrompt(): Promise<unknown> {
    const request = await this.page.waitForRequest(
      (candidate) =>
        candidate.method() === 'POST' &&
        new URL(candidate.url()).pathname === '/api/prompt'
    )
    return request.postDataJSON()
  }

  /** Reads the capture the last queued prompt carried and its uploaded bytes. */
  private async captureFor(promptBody: unknown): Promise<Load3dCapture> {
    const promptImage = promptImageRef(promptBody)
    const name = PROMPT_IMAGE_REF.exec(promptImage)?.[1]
    const upload = name === undefined ? undefined : this.uploadsByName.get(name)
    if (!upload)
      throw new Error(
        `the prompt references ${promptImage}, which was never uploaded`
      )
    return { promptImage, imageBytes: await uploadedImageBytes(upload) }
  }

  /** Queues a prompt and returns the capture it carried. */
  async capture(): Promise<Load3dCapture> {
    return this.captureFor(await this.queuePrompt())
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) =>
      route.fulfill(jsonRoute([]))
    )
    // No cloud workflow carries the agent's id, so the panel opens a new tab for it.
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        })
      )
    )
  }

  private async mockLoad3dIo(): Promise<void> {
    const { page } = this
    await page.route('**/api/upload/image**', (route) => {
      const name = `agent-load3d-capture-${++this.uploads}.png`
      this.uploadsByName.set(name, route.request())
      return route.fulfill(jsonRoute({ name, subfolder: 'temp', type: 'temp' }))
    })
    for (const [model, asset] of Object.entries(MODEL_ASSETS)) {
      await page.route(`**/api/view?*filename=${model}*`, (route) =>
        route.fulfill({ path: assetPath(asset) })
      )
    }
    await page.route(/\/api\/prompt$/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill(
        jsonRoute({ prompt_id: crypto.randomUUID(), node_errors: {} })
      )
    })
  }
}

interface Load3dAgentFixtures {
  load3dAgent: Load3dAgentHarness
}

export const load3dAgentTest = agentTest.extend<Load3dAgentFixtures>({
  load3dAgent: async ({ page, agentFlagEnabled }, use) => {
    const harness = new Load3dAgentHarness(page)
    await harness.boot(agentFlagEnabled)
    await use(harness)
  }
})
