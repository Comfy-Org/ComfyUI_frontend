import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  AgentThreadListResponse,
  JobsListResponse
} from '@comfyorg/ingest-types'
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'
import type { PromptResponse } from '@/platform/remote/comfyui/types'
import type {
  ComfyApiWorkflow,
  WorkflowJSON04
} from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  zComfyApiWorkflow,
  zComfyWorkflow
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type {
  AgentMessages,
  AgentRunModePreference,
  AgentTurnAccepted
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockSavedWorkflowPersistence } from '@e2e/fixtures/utils/savedWorkflowPersistence'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'
import {
  CONNECTED_SOCKET_SLOTS,
  EXPECTED_TARGETS,
  MESSAGE_ID,
  NODE_TYPE,
  SOCKET_SID,
  SOURCE_NODE_ID,
  SOURCE_NODE_TYPE,
  SPARE_SLOTS,
  TARGET_ID,
  TARGET_NODE_ID,
  THREAD_ID,
  WORKFLOW_ID,
  catalog,
  nodeDef,
  seed,
  sourceNodeDef
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

export const SENTINEL_PROMPT = 'multi-autogrow-realign-sentinel-prompt'
export const SENTINEL_WIDTH = 777
export const SENTINEL_HEIGHT = 555
export const CORRUPTED_PROMPT = 'multi-autogrow-realign-corrupted-prompt'

/**
 * The saved workflow's own name. Explicit rather than the default "Unsaved
 * Workflow": a reload always offers a fresh tab under that default name, so a
 * reopen by name would silently pick the empty one and never read the saved
 * file back.
 */
const SAVED_WORKFLOW_NAME = 'Multi autogrow realign'

const RELOAD_READY_TIMEOUT = 30_000

function getQueuedPrompt(body: unknown): ComfyApiWorkflow {
  if (typeof body !== 'object' || body === null || !('prompt' in body)) {
    throw new Error('Expected /api/prompt body to contain a prompt object')
  }
  return zComfyApiWorkflow.parse(body.prompt)
}

type ParsedSavedNode = WorkflowJSON04['nodes'][number]

type SavedLinkTarget = readonly [ParsedSavedNode['id'], string]

export class MultiAutogrowRealignHarness {
  private readonly host = new HostDoc(WORKFLOW_ID, seed, catalog)
  readonly hostSocket: AgentFollowerHostSocket
  readonly topbar: Topbar
  readonly vueNodes: VueNodeHelpers
  readonly agentPanel: AgentPanel

  readonly panel: Locator
  readonly targetNode: Locator
  readonly promptField: Locator
  readonly widthInput: Locator
  readonly heightInput: Locator

  private submittedPrompt: ComfyApiWorkflow | undefined
  private persistence:
    | Awaited<ReturnType<typeof mockSavedWorkflowPersistence>>
    | undefined

  private requireSubmittedPrompt(): ComfyApiWorkflow {
    const prompt = this.submittedPrompt
    if (!prompt) throw new Error('No prompt was submitted')
    return prompt
  }

  constructor(private readonly page: Page) {
    this.hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      this.host,
      SOCKET_SID,
      'apply'
    )
    this.topbar = new Topbar(page)
    this.vueNodes = new VueNodeHelpers(page)
    this.agentPanel = new AgentPanel(page)

    this.panel = this.agentPanel.root
    this.targetNode = this.vueNodes.getNodeLocator(TARGET_ID)
    this.promptField = this.targetNode.getByRole('textbox', { name: 'prompt' })
    this.widthInput = this.vueNodes.getInputNumberControls(
      this.targetNode.getByLabel('width', { exact: true }).first()
    ).input
    this.heightInput = this.vueNodes.getInputNumberControls(
      this.targetNode.getByLabel('height', { exact: true }).first()
    ).input
  }

  async setUp(): Promise<void> {
    const { page } = this
    // Registered before `bootAgentApp` (with `objectInfo: 'server'` below) so
    // it wins over the empty handler `mockCloudBootRoutes` would otherwise
    // register afterward for the same route -- Playwright runs the
    // most-recently-registered matching handler first.
    await page.route('**/api/object_info', (route) =>
      route.fulfill(
        jsonRoute({
          [SOURCE_NODE_TYPE]: sourceNodeDef,
          [NODE_TYPE]: nodeDef
        })
      )
    )

    // Neither route is registered by `bootAgentApp`'s own boot mocks: the
    // model-folder list is read while the panel chrome renders, and
    // `queueStore`'s background job poll runs for the lifetime of every one
    // of this file's tests, not only a scenario that sends a second turn.
    const folders: ModelFolderInfo[] = []
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute(folders))
    )
    const jobs: JobsListResponse = {
      jobs: [],
      pagination: { offset: 0, limit: 200, total: 0, has_more: false }
    }
    await page.route('**/api/jobs?*', (route) => route.fulfill(jsonRoute(jobs)))

    await this.hostSocket.install()

    const threadList: AgentThreadListResponse = {
      pagination: { has_more: false, limit: 100, offset: 0, total: 0 },
      threads: []
    }
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threadList))
    )
    const runModePreference: AgentRunModePreference = {
      mode: 'ask_approval',
      credit_limit: null
    }
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runModePreference))
    )
    const turnAccepted: AgentTurnAccepted = {
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID,
      workflow_id: WORKFLOW_ID
    }
    // Stateful once the turn is sent: a page reload re-runs
    // `useAgentSession.start()`, which finds the persisted thread id in
    // `localStorage` and hydrates from this same endpoint -- the message row's
    // `workflow_id` is what lets the agent panel rebind its target and
    // resubscribe the CRDT follower after the reload.
    let turnSent = false
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST') {
        const history: AgentMessages = turnSent
          ? [
              {
                id: 'msg-user-1',
                role: 'user',
                seq: 1,
                status: 'complete',
                thread_id: THREAD_ID,
                turn_id: 'turn-1',
                workflow_id: WORKFLOW_ID,
                content: { text: 'hello' }
              }
            ]
          : []
        return route.fulfill(jsonRoute(history))
      }
      turnSent = true
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(turnAccepted)
      })
    })

    await bootAgentApp(page, true, {
      objectInfo: 'server',
      // Only the Vue node renderer projects follower edits onto the canvas as
      // DOM this test can query.
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      }
    })

    // Registered only now, same as `AgentConversationHarness.
    // selectWorkflowTarget`: `bootAgentApp`'s own mocks blanket-match
    // `**/api/userdata**` for every method, and Playwright runs the
    // most-recently-registered matching route first.
    this.persistence = await mockSavedWorkflowPersistence(page, WORKFLOW_ID)

    await page.route('**/api/prompt', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      this.submittedPrompt = getQueuedPrompt(route.request().postDataJSON())
      const response: PromptResponse = {
        prompt_id: 'b6c1a2d3-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
        number: 1,
        node_errors: {}
      }
      return route.fulfill(jsonRoute(response))
    })
  }

  savedName(): string | undefined {
    return this.persistence?.savedName()
  }

  corruptSavedContentPrompt(replacement: string): void {
    const original = this.persistence?.savedContent()
    if (original === undefined) throw new Error('workflow was not saved')
    this.persistence?.corruptSavedContent(
      original.replaceAll(SENTINEL_PROMPT, replacement)
    )
  }

  expectedSavedLinkTargets(): readonly SavedLinkTarget[] {
    return EXPECTED_TARGETS.map(
      ({ name }) => [TARGET_NODE_ID, name] as const satisfies SavedLinkTarget
    )
  }

  async targetActiveWorkflow(): Promise<void> {
    await loadSeedIntoActiveTab(this.page, seed)
    await this.agentPanel.open()
    await this.agentPanel.selectWorkflow()
  }

  async bindAndAwaitFirstTurn(): Promise<void> {
    await this.targetActiveWorkflow()
    await this.sendTurn('hello')
    await this.hostSocket.waitForSubscribe()
    await expect(this.targetNode).toBeVisible()
  }

  /**
   * Sends a turn and settles it from the host. `agent_message_done` is only
   * routed while the store already holds the ack's `message_id`
   * (`agentConversationStore.ingest`), so this waits for the assistant
   * placeholder that `startTurn` renders from that ack before answering --
   * otherwise the frame is dropped and the turn never settles.
   */
  async sendTurn(text: string): Promise<void> {
    await this.panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill(text)
    await this.panel
      .getByRole('button', { name: enMessages.agent.send })
      .click()
    await expect(
      this.panel.getByText(enMessages.agent.thinking).first()
    ).toBeVisible()
    this.hostSocket.send({
      type: 'agent_message_done',
      data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
    })
    await expect(
      this.panel.getByRole('button', { name: enMessages.agent.stop })
    ).toHaveCount(0)
  }

  private readLinkTargets() {
    return this.page.evaluate(
      (linkIds) => {
        const app = window.app
        if (!app) throw new Error('window.app is not available')
        const graph = app.graph
        return linkIds.map((id) => {
          const link = graph.links.get(id)
          if (!link) return undefined
          return graph.getNodeById(link.target_id)?.inputs[link.target_slot]
            ?.name
        })
      },
      EXPECTED_TARGETS.map(({ linkId }) => toLinkId(linkId))
    )
  }

  private resolveInputSlotIndex(name: string) {
    return this.page.evaluate(
      ({ nodeId, name }) => {
        const app = window.app
        if (!app) throw new Error('window.app is not available')
        return app.graph.getNodeById(nodeId)?.findInputSlot(name) ?? -1
      },
      { nodeId: toNodeId(TARGET_NODE_ID), name }
    )
  }

  async expectEveryLinkOnItsNamedSlot(): Promise<void> {
    await expect
      .poll(() => this.readLinkTargets())
      .toEqual(EXPECTED_TARGETS.map(({ name }) => name))
    for (const { name } of CONNECTED_SOCKET_SLOTS) {
      const index = await this.resolveInputSlotIndex(name)
      expect(index).toBeGreaterThanOrEqual(0)
      await expect(this.vueNodes.getInputSlotRow(TARGET_ID, index)).toHaveClass(
        /lg-slot--connected/
      )
    }
    for (const { name } of SPARE_SLOTS) {
      const index = await this.resolveInputSlotIndex(name)
      expect(index).toBeGreaterThanOrEqual(0)
      await expect(
        this.vueNodes.getInputSlotRow(TARGET_ID, index)
      ).not.toHaveClass(/lg-slot--connected/)
    }
  }

  async submitAndReadTargetInputs(): Promise<
    ComfyApiWorkflow[string]['inputs']
  > {
    this.submittedPrompt = undefined
    await this.page
      .getByRole('button', { name: enMessages.menu.run, exact: true })
      .click()
    await expect.poll(() => this.submittedPrompt !== undefined).toBe(true)
    const submittedPrompt = this.requireSubmittedPrompt()
    if (!(TARGET_ID in submittedPrompt)) {
      throw new Error(`Submitted prompt has no node ${TARGET_ID}`)
    }
    const target = submittedPrompt[TARGET_ID]
    return target.inputs
  }

  async expectSubmittedValuesNamedCorrectly(
    expectedPrompt = SENTINEL_PROMPT
  ): Promise<void> {
    const inputs = await this.submitAndReadTargetInputs()
    expect(inputs.prompt).toBe(expectedPrompt)
    expect(inputs.width).toBe(SENTINEL_WIDTH)
    expect(inputs.height).toBe(SENTINEL_HEIGHT)
    const sourceId = String(SOURCE_NODE_ID)
    expect(inputs['ref_images.ref_image_0']).toEqual([sourceId, 0])
    expect(inputs['ref_images.ref_image_1']).toEqual([sourceId, 1])
    expect(inputs['ref_videos.ref_video_0']).toEqual([sourceId, 2])
    expect(inputs['ref_videos.ref_video_1']).toEqual([sourceId, 3])
  }

  async fillSentinelWidgetValues(): Promise<void> {
    await this.promptField.fill(SENTINEL_PROMPT)
    await this.promptField.blur()
    await this.widthInput.fill(String(SENTINEL_WIDTH))
    await this.widthInput.blur()
    await this.heightInput.fill(String(SENTINEL_HEIGHT))
    await this.heightInput.blur()
    await expect(this.widthInput).toHaveValue(String(SENTINEL_WIDTH))
    await expect(this.heightInput).toHaveValue(String(SENTINEL_HEIGHT))
  }

  async expectSentinelWidgetValues(
    expectedPrompt = SENTINEL_PROMPT
  ): Promise<void> {
    await expect(this.promptField).toHaveValue(expectedPrompt)
    await expect(this.widthInput).toHaveValue(String(SENTINEL_WIDTH))
    await expect(this.heightInput).toHaveValue(String(SENTINEL_HEIGHT))
  }

  async expectHostDocHasSentinelValues(): Promise<void> {
    await expect
      .poll(
        () =>
          this.host
            .projection()
            .nodes.find((node) => node.id === TARGET_NODE_ID)?.widgets_values
      )
      .toEqual([SENTINEL_PROMPT, SENTINEL_WIDTH, SENTINEL_HEIGHT])
  }

  async switchTabsAwayAndBack(): Promise<void> {
    await expect(this.topbar.tabs).toHaveCount(1)
    await this.topbar.newWorkflowButton.click()
    await expect(this.topbar.tabs).toHaveCount(2)
    await expect(
      this.topbar.getTab(1).and(this.topbar.getActiveTab())
    ).toBeVisible()
    await this.topbar.getTab(0).click()
    await expect(
      this.topbar.getTab(0).and(this.topbar.getActiveTab())
    ).toBeVisible()
    await this.topbar.dismissWorkflowPopover()
    await expect.poll(() => this.hostSocket.subscribeCount()).toBe(2)
  }

  async saveAndReadPostedGraph(): Promise<{
    widgetValues: ParsedSavedNode['widgets_values'] | undefined
    linkTargets: readonly (SavedLinkTarget | undefined)[]
  }> {
    const saveResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        decodeURIComponent(new URL(response.url()).pathname).startsWith(
          '/api/userdata/workflows/'
        ) &&
        response.ok()
    )
    await this.topbar.saveWorkflowAs(SAVED_WORKFLOW_NAME)
    const response = await saveResponse
    const workflow = zComfyWorkflow.parse(
      JSON.parse(response.request().postData() ?? '{}')
    )
    const target = workflow.nodes.find((node) => node.id === TARGET_NODE_ID)
    return {
      widgetValues: target?.widgets_values,
      linkTargets: EXPECTED_TARGETS.map(({ linkId }) => {
        const link = workflow.links.find(([id]) => id === linkId)
        const inputName = link && target?.inputs?.[link[4]]?.name
        return link && inputName
          ? ([link[3], inputName] as const satisfies SavedLinkTarget)
          : undefined
      })
    }
  }

  /**
   * Reloads and reopens the saved workflow, then proves the reopen actually
   * read the saved path off the server rather than being satisfiable by draft
   * or cache state that never touched this GET.
   *
   * It deliberately does NOT wait for the CRDT follower to resubscribe. A
   * reload drops the page-session binding by design -- reattachment is
   * explicit, driven by a new turn (see `agentFollowerReloadBinding.spec.ts`
   * and https://github.com/Comfy-Org/ComfyUI_frontend/pull/16849) -- so the
   * restored canvas here comes from the saved bytes, not from a live
   * subscription.
   */
  async reloadAndReopenSavedWorkflow(): Promise<void> {
    const getsBeforeReload = this.persistence?.servedContentGets() ?? 0

    // Evicts the local workflow draft cache so the reopened GET response is
    // the only thing that can satisfy the value assertions.
    await this.page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('Comfy.Workflow.Draft')) {
          localStorage.removeItem(key)
        }
      }
    })
    await this.page.reload()

    // The panel's open state persisted, so it remounts itself open once the
    // agent gate resolves -- clicking the toggle again races that restore.
    await expect(this.topbar.integratedTabBarActions).toHaveAttribute(
      'data-agent-gate-settled',
      'true',
      { timeout: RELOAD_READY_TIMEOUT }
    )
    await expect(this.panel).toBeVisible({ timeout: RELOAD_READY_TIMEOUT })

    // A fresh reload does not reopen this workflow's tab on its own, and the
    // follower only ever subscribes while its bound workflow is the *active*
    // tab (`isBoundWorkflowActive` in AgentPanelRoot.vue).
    const reopenedName = this.savedName()
    if (reopenedName === undefined) throw new Error('workflow was not saved')
    await this.agentPanel.selectWorkflow(reopenedName)

    // Proves the reopen actually read the saved bytes back off the mock,
    // rather than the value assertions being satisfiable by draft or cache
    // state that never touched this GET.
    await expect
      .poll(() => this.persistence?.servedContentGets() ?? 0, {
        timeout: RELOAD_READY_TIMEOUT
      })
      .toBeGreaterThan(getsBeforeReload)
  }
}
