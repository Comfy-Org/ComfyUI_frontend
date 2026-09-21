import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  AgentThreadListResponse,
  JobsListResponse
} from '@comfyorg/ingest-types'
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'
import type { PromptResponse } from '@/platform/remote/comfyui/types'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
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

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockSavedWorkflowPersistence } from '@e2e/fixtures/utils/savedWorkflowPersistence'
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

/**
 * A node with two independent COMFY_AUTOGROW_V3 groups (reduced from
 * MiniMaxH3ReferenceToVideo's `ref_images`/`ref_videos` shape) had its links
 * silently re-target to the wrong input once both groups had already grown
 * on a saved graph -- e.g. a MiniMax-style template reaching disk with two
 * live groups whose growth interleaved as they were wired up.
 *
 * Root cause: the CRDT follower materialized an agent-authored node by
 * building link adapters against the saved DOCUMENT's input positions.
 * `node.configure()` and COMFY_AUTOGROW_V3 growth reorder LIVE inputs as
 * the node is built, so with two or more autogrow groups sharing a node,
 * the adapters kept pointing at stale indexes: a link painted on the wrong
 * socket, and the value read at submit time was wrong for the same reason.
 *
 * Fixed in `graphMutations.ts`'s `mergeInputSlotsByName`/`prepareNode`: a
 * reconcile now resolves each saved link's destination by the input's NAME
 * against the live node, not by the document's position, so live order wins
 * regardless of how many autogrow groups reordered it.
 *
 * This drives the real CRDT follower over a mocked `/ws` socket
 * (`AgentFollowerHostSocket`) and reads the painted result off the live
 * canvas, the way a user would see it: right after the workflow is
 * subscribed, again after a tab switch forces the follower to resubscribe
 * and reconcile the same node in place, once more after a full page
 * reload forces the same resubscribe from a cold start, and again after a
 * new turn against the reopened workflow explicitly reattaches the
 * follower and the host pushes a fresh edit. It also proves the PR's
 * submitted-value guarantee: the reconcile must not just paint links
 * correctly while still serializing a scalar widget's or a link's value
 * under the wrong input name.
 *
 * See `agentNodeMaterializer.multiAutogrow.test.ts` for the Vitest
 * regression on the same interleaved shape, and
 * `agentAutogrowTabSwitchReconcile.spec.ts` for the same tab-switch replay
 * mechanism (its note that a node the store already holds -- unlike a
 * brand new one -- is reconciled rather than freshly added).
 */

const SENTINEL_PROMPT = 'multi-autogrow-realign-sentinel-prompt'
const SENTINEL_WIDTH = 777
const SENTINEL_HEIGHT = 555

// Same narrow-then-parse boundary crossing `linksExecution.spec.ts` uses for
// a captured `/api/prompt` body: `postDataJSON()` is `unknown`, so this
// confirms the shape before handing `.prompt` to the schema that owns
// validating it.
function getQueuedPrompt(body: unknown): ComfyApiWorkflow {
  if (typeof body !== 'object' || body === null || !('prompt' in body)) {
    throw new Error('Expected /api/prompt body to contain a prompt object')
  }
  return zComfyApiWorkflow.parse(body.prompt)
}

/**
 * Runs the full multi-autogrow realign scenario through to the persisted
 * reload. With `corruptPersistedContent`, the saved bytes are tampered with
 * (after the real save, before the reload) so the reopen serves a
 * different prompt than what was actually saved -- this proves the
 * post-reload sentinel assertions below fail when the persisted bytes
 * disagree, rather than passing regardless of what the GET actually
 * returns (e.g. off draft/cache state).
 */
async function runMultiAutogrowRealignScenario(
  page: Page,
  testInfo: TestInfo,
  {
    corruptPersistedContent = false
  }: { corruptPersistedContent?: boolean } = {}
): Promise<void> {
  // Registered before `bootAgentApp` (with `objectInfo: 'server'` below)
  // so it wins over the empty handler `mockCloudBootRoutes` would
  // otherwise register afterward for the same route -- Playwright runs
  // the most-recently-registered matching handler first.
  await page.route('**/api/object_info', (route) =>
    route.fulfill(
      jsonRoute({
        [SOURCE_NODE_TYPE]: sourceNodeDef,
        [NODE_TYPE]: nodeDef
      })
    )
  )

  const host = new HostDoc(WORKFLOW_ID, seed, catalog)
  const hostSocket = new AgentFollowerHostSocket(
    page,
    WORKFLOW_ID,
    host,
    SOCKET_SID,
    'apply'
  )
  await hostSocket.install()

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
  // `localStorage` and hydrates from this same endpoint -- the message
  // row's `workflow_id` is what lets the agent panel rebind its target
  // and resubscribe the CRDT follower after the reload, proving
  // persistence survives it rather than just a tab switch.
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
    // Only the Vue node renderer projects follower edits onto the
    // canvas as DOM this test can query.
    settings: {
      'Comfy.VueNodes.Enabled': true,
      'Comfy.Graph.CanvasInfo': false
    }
  })

  // Registered only now, same as `AgentConversationHarness.
  // selectWorkflowTarget`: `bootAgentApp`'s own mocks blanket-match
  // `**/api/userdata**` for every method, and Playwright runs the
  // most-recently-registered matching route first, so this has to come
  // after it to take over the workflow-save round trip.
  const { savedName, savedContent, corruptSavedContent } =
    await mockSavedWorkflowPersistence(page, WORKFLOW_ID)
  let savedPathGets = 0
  await page.route('**/api/userdata/workflows/*.json', (route) => {
    if (route.request().method() === 'GET') savedPathGets++
    return route.fallback()
  })

  // Captures the exact body a real Run submits, keyed by node id ->
  // `{inputs}` -- a literal value under a scalar widget's own name, or
  // an `[originNodeId, originSlot]` tuple under a linked slot's own
  // name. Overwritten on every submit so re-running after the reload
  // step below reads that submission, not a stale one.
  let submittedPrompt: ComfyApiWorkflow | undefined
  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    submittedPrompt = getQueuedPrompt(route.request().postDataJSON())
    const response: PromptResponse = {
      prompt_id: 'b6c1a2d3-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      number: 1,
      node_errors: {}
    }
    return route.fulfill(jsonRoute(response))
  })

  const topbar = new Topbar(page)
  const vueNodes = new VueNodeHelpers(page)
  const agentPanel = new AgentPanel(page)
  const panel = agentPanel.root

  const readLinkTargets = () =>
    page.evaluate(
      (linkIds) => {
        const graph = window.app!.graph
        return linkIds.map((id) => {
          const link = graph.links.get(id)
          if (!link) return undefined
          return graph.getNodeById(link.target_id)?.inputs[link.target_slot]
            ?.name
        })
      },
      EXPECTED_TARGETS.map(({ linkId }) => toLinkId(linkId))
    )

  // Resolves a named input's actual live slot index, rather than
  // assuming it matches the seed's position -- see the comment on
  // `SPARE_SLOTS` in the fixture module.
  const resolveInputSlotIndex = (name: string) =>
    page.evaluate(
      ({ nodeId, name }) =>
        window.app!.graph.getNodeById(nodeId)?.findInputSlot(name) ?? -1,
      { nodeId: toNodeId(TARGET_NODE_ID), name }
    )

  // Verified independently below (the graph read above is the same
  // canonical link map litegraph paints wires from), the DOM check
  // additionally confirms the socket rows this test cares about are
  // actually rendered and marked connected on the canvas.
  async function assertVisiblyCorrect(): Promise<void> {
    await expect
      .poll(readLinkTargets)
      .toEqual(EXPECTED_TARGETS.map(({ name }) => name))
    for (const { name } of CONNECTED_SOCKET_SLOTS) {
      const index = await resolveInputSlotIndex(name)
      expect(index).toBeGreaterThanOrEqual(0)
      await expect(vueNodes.getInputSlotRow(TARGET_ID, index)).toHaveClass(
        /lg-slot--connected/
      )
    }
    for (const { name } of SPARE_SLOTS) {
      const index = await resolveInputSlotIndex(name)
      expect(index).toBeGreaterThanOrEqual(0)
      await expect(vueNodes.getInputSlotRow(TARGET_ID, index)).not.toHaveClass(
        /lg-slot--connected/
      )
    }
  }

  // Clicks the real Run button and waits for the resulting `/api/prompt`
  // submission, rather than calling `app.queuePrompt()` directly (see
  // `browser_tests/README.md`'s `page.evaluate` guidance: an action with
  // a UI equivalent goes through the UI). An implementation that keeps
  // the canvas painted correctly (asserted above) but serializes a
  // scalar or a link positionally in that submitted body would still
  // fail this.
  async function runAndCaptureSubmission(): Promise<
    ComfyApiWorkflow[string]['inputs']
  > {
    submittedPrompt = undefined
    await page
      .getByRole('button', { name: enMessages.menu.run, exact: true })
      .click()
    await expect.poll(() => submittedPrompt !== undefined).toBe(true)
    return submittedPrompt![TARGET_ID].inputs
  }

  async function assertSubmittedValuesNamedCorrectly(
    expectedPrompt = SENTINEL_PROMPT
  ): Promise<void> {
    const inputs = await runAndCaptureSubmission()
    expect(inputs.prompt).toBe(expectedPrompt)
    expect(inputs.width).toBe(SENTINEL_WIDTH)
    expect(inputs.height).toBe(SENTINEL_HEIGHT)
    const sourceId = String(SOURCE_NODE_ID)
    expect(inputs['ref_images.ref_image_0']).toEqual([sourceId, 0])
    expect(inputs['ref_images.ref_image_1']).toEqual([sourceId, 1])
    expect(inputs['ref_videos.ref_video_0']).toEqual([sourceId, 2])
    expect(inputs['ref_videos.ref_video_1']).toEqual([sourceId, 3])
  }

  async function fillSentinelWidgetValues(): Promise<void> {
    const nodeLocator = vueNodes.getNodeLocator(TARGET_ID)
    const promptField = nodeLocator.getByRole('textbox', {
      name: 'prompt'
    })
    await promptField.fill(SENTINEL_PROMPT)
    await promptField.blur()

    const widthWidget = nodeLocator.getByLabel('width', { exact: true }).first()
    const heightWidget = nodeLocator
      .getByLabel('height', { exact: true })
      .first()
    const widthInput = vueNodes.getInputNumberControls(widthWidget).input
    const heightInput = vueNodes.getInputNumberControls(heightWidget).input
    await widthInput.fill(String(SENTINEL_WIDTH))
    await widthInput.blur()
    await heightInput.fill(String(SENTINEL_HEIGHT))
    await heightInput.blur()

    await expect(widthInput).toHaveValue(String(SENTINEL_WIDTH))
    await expect(heightInput).toHaveValue(String(SENTINEL_HEIGHT))
  }

  await test.step('open the agent panel and target the workflow', async () => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
  })

  await test.step('send a turn so the session binds the workflow', async () => {
    const composer = panel.getByRole('textbox', {
      name: /^Describe ideas/
    })
    await composer.fill('hello')
    await panel.getByRole('button', { name: enMessages.agent.send }).click()
    await expect(panel.getByText('hello').first()).toBeVisible()
    hostSocket.send({
      type: 'agent_message_done',
      data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
    })
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop })
    ).toHaveCount(0)
    await hostSocket.waitForSubscribe()
  })

  await test.step('every link lands on its named slot right after materialization', async () => {
    await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible()
    await assertVisiblyCorrect()
  })

  await test.step('a tab switch forces a reconcile of the same node, and every link is still correct', async () => {
    // A brand-new node materialized for the first time is trivially
    // correct (there is no live node yet to disagree with the
    // document); a tab switch re-subscribes the follower and replays
    // the whole document over the node record the store already holds,
    // which is the reconcile this fix actually changed. See
    // `agentAutogrowTabSwitchReconcile.spec.ts`.
    await expect(topbar.workflowTabs.locator('.p-togglebutton')).toHaveCount(1)
    await topbar.newWorkflowButton.click()
    await expect(topbar.workflowTabs.locator('.p-togglebutton')).toHaveCount(2)
    await expect(topbar.getTab(1)).toHaveAttribute('aria-pressed', 'true')
    await topbar.getTab(0).click()
    await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
    await expect.poll(() => hostSocket.subscribeCount()).toBe(2)

    await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible()
    await assertVisiblyCorrect()
  })

  await test.step('submitting the workflow serializes every scalar and link under its own name', async () => {
    await fillSentinelWidgetValues()
    await assertSubmittedValuesNamedCorrectly()
    // The submitted body above only proves the live app's own document is
    // correct; this confirms the widget edits actually round-tripped to the
    // host's CRDT doc (via the `apply` host, not just `hold`), which the
    // saved-file reload and reattach steps below depend on.
    await expect
      .poll(
        () =>
          host.projection().nodes.find((node) => node.id === TARGET_NODE_ID)
            ?.widgets_values
      )
      .toEqual([SENTINEL_PROMPT, SENTINEL_WIDTH, SENTINEL_HEIGHT])
  })

  await test.step('saving persists the sentinel values to the userdata mock', async () => {
    // No leftover dialog (e.g. a save-conflict prompt from an earlier
    // step) can be sitting in front of the canvas eating the shortcut
    // below.
    await expect(page.getByRole('dialog', { includeHidden: true })).toHaveCount(
      0
    )

    // Forces a real save of the *current* (sentinel-bearing) graph
    // through the same round trip a user's Ctrl+S takes, so
    // `savedWorkflowContent` actually holds the state the reload step
    // below claims survives a reopen, rather than whatever the
    // target-selection step above auto-saved before any edits existed.
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        decodeURIComponent(new URL(response.url()).pathname).startsWith(
          '/api/userdata/workflows/'
        ) &&
        response.ok()
    )
    // Presses the shortcut on the canvas itself (as `KeyboardHelper`
    // does), not the bare page keyboard: the previous step's number
    // inputs can still hold focus, and an unfocused `Control+s` is
    // swallowed by that control instead of reaching the app.
    await page.locator('#graph-canvas').press('Control+s')
    const response = await saveResponse

    // Validates the exact bytes POSTed, not just that a save happened:
    // proves the serializer itself named every scalar and link correctly,
    // independent of whatever the reopen step below reads back.
    const workflow = zComfyWorkflow.parse(
      JSON.parse(response.request().postData() ?? '{}')
    )
    const target = workflow.nodes.find((node) => node.id === TARGET_NODE_ID)
    expect(target?.widgets_values).toEqual([
      SENTINEL_PROMPT,
      SENTINEL_WIDTH,
      SENTINEL_HEIGHT
    ])
    expect(
      EXPECTED_TARGETS.map(({ linkId }) => {
        const link = workflow.links.find(([id]) => id === linkId)
        return link && [link[3], target?.inputs?.[link[4]]?.name]
      })
    ).toEqual(EXPECTED_TARGETS.map(({ name }) => [TARGET_NODE_ID, name]))

    if (corruptPersistedContent) {
      const original = savedContent()
      if (original === undefined) throw new Error('workflow was not saved')
      // A real save always contains the sentinel prompt text verbatim;
      // replacing it (rather than fulfilling with an unrelated body)
      // keeps the graph structure the rest of this step already
      // verified intact, isolating the corruption to the one value the
      // assertions below check against the GET response.
      corruptSavedContent(original.replace(SENTINEL_PROMPT, 'corrupted'))
    }
  })

  await test.step('a full page reload forces the same resubscribe, and every link and value survive it', async () => {
    const subscribesBeforeReload = hostSocket.subscribeCount()
    const getsBeforeReload = savedPathGets

    // Evicts the local workflow draft cache so the assertions below can
    // only be satisfied by the reopened GET response, not by draft
    // state `page.reload()` itself would otherwise restore.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('Comfy.Workflow.Draft')) {
          localStorage.removeItem(key)
        }
      }
    })
    await page.reload()

    // The panel's open state persisted through the earlier `agentPanel.
    // open()` call, so it remounts itself open once the agent gate
    // resolves -- clicking the (toggle) open button again here races
    // that restore and can flip it back closed. Wait for the gate
    // instead, the same way `agentChatRefreshPersistence.spec.ts` and
    // `agentPanelLifecycle.spec.ts`'s reload test do.
    await expect(topbar.integratedTabBarActions).toHaveAttribute(
      'data-agent-gate-settled',
      'true',
      { timeout: 30_000 }
    )
    await expect(panel).toBeVisible({ timeout: 30_000 })

    // Must happen before polling `subscribeCount`: the follower only
    // subscribes while its bound workflow is also the *active* tab
    // (`isBoundWorkflowActive` in AgentPanelRoot.vue), and a fresh
    // reload does not reopen this workflow's tab on its own.
    const reopenedName = savedName()
    if (reopenedName === undefined) throw new Error('workflow was not saved')
    await agentPanel.selectWorkflow(reopenedName)

    await expect
      .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
      .toBeGreaterThan(subscribesBeforeReload)
    // Proves the reopen actually read the saved path off the server,
    // rather than the assertions below being satisfiable by draft or
    // cache state that never touched this GET.
    await expect
      .poll(() => savedPathGets, { timeout: 30_000 })
      .toBeGreaterThan(getsBeforeReload)

    await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible({
      timeout: 30_000
    })
    await assertVisiblyCorrect()

    const assertPersistedValuesSurvived = async (): Promise<void> => {
      const nodeLocator = vueNodes.getNodeLocator(TARGET_ID)
      await expect(
        nodeLocator.getByRole('textbox', { name: 'prompt' })
      ).toHaveValue(SENTINEL_PROMPT)
      const widthWidget = nodeLocator
        .getByLabel('width', { exact: true })
        .first()
      const heightWidget = nodeLocator
        .getByLabel('height', { exact: true })
        .first()
      await expect(
        vueNodes.getInputNumberControls(widthWidget).input
      ).toHaveValue(String(SENTINEL_WIDTH))
      await expect(
        vueNodes.getInputNumberControls(heightWidget).input
      ).toHaveValue(String(SENTINEL_HEIGHT))

      await assertSubmittedValuesNamedCorrectly()
    }

    if (corruptPersistedContent) {
      await expect(assertPersistedValuesSurvived()).rejects.toThrow()
      return
    }
    await assertPersistedValuesSurvived()

    const restoredScreenshot = testInfo.outputPath('saved-file-restored.png')
    await page.screenshot({ path: restoredScreenshot })
    await testInfo.attach('saved-file-restored', {
      path: restoredScreenshot,
      contentType: 'image/png'
    })
  })

  // The reload above already forced a resubscribe on its own (see the
  // `subscribesBeforeReload` poll). This step proves the *other* path to
  // reattachment also works: sending a brand-new turn against the
  // reopened workflow subscribes the follower again, and edits the host
  // pushes after that reattach reach the live canvas, rather than only
  // ones that happened to arrive before the follower dropped its old
  // subscription.
  if (corruptPersistedContent) return
  await test.step('a new turn against the reopened workflow reattaches the follower, and a fresh host edit still lands', async () => {
    const nodeLocator = vueNodes.getNodeLocator(TARGET_ID)
    const widthWidget = nodeLocator.getByLabel('width', { exact: true }).first()
    const heightWidget = nodeLocator
      .getByLabel('height', { exact: true })
      .first()

    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Check the restored workflow')
    const subscribesBeforeTurn = hostSocket.subscribeCount()
    await panel.getByRole('button', { name: enMessages.agent.send }).click()
    await expect
      .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
      .toBeGreaterThan(subscribesBeforeTurn)
    hostSocket.send({
      type: 'agent_message_done',
      data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
    })
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop })
    ).toHaveCount(0)
    await assertVisiblyCorrect()
    await expect(
      nodeLocator.getByRole('textbox', { name: 'prompt' })
    ).toHaveValue(SENTINEL_PROMPT)
    await expect(
      vueNodes.getInputNumberControls(widthWidget).input
    ).toHaveValue(String(SENTINEL_WIDTH))
    await expect(
      vueNodes.getInputNumberControls(heightWidget).input
    ).toHaveValue(String(SENTINEL_HEIGHT))
    await assertSubmittedValuesNamedCorrectly()

    const freshPrompt = 'fresh host edit after saved-file reload'
    hostSocket.send(
      host.apply([
        {
          op: 'set_widget',
          node_id: TARGET_NODE_ID,
          widget: 'prompt',
          value: freshPrompt
        }
      ])
    )
    await expect(
      nodeLocator.getByRole('textbox', { name: 'prompt' })
    ).toHaveValue(freshPrompt)
    await assertVisiblyCorrect()
    await assertSubmittedValuesNamedCorrectly(freshPrompt)

    const replayScreenshot = testInfo.outputPath('fresh-host-edit.png')
    await page.screenshot({ path: replayScreenshot })
    await testInfo.attach('fresh-host-edit', {
      path: replayScreenshot,
      contentType: 'image/png'
    })
  })
}

test.describe(
  'Agent CRDT multi-autogrow link realignment',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    // The reattach step below sends a second turn, which re-renders chrome
    // (models picker, jobs indicator) that the boot mocks in
    // `cloudBootMocks.ts` don't cover -- registered here, ahead of
    // `bootAgentApp`'s own routes, they still win for these two paths since
    // nothing else ever claims them (see the "most-recently-registered
    // wins" note elsewhere in this file for why order matters when two
    // handlers *do* overlap).
    test.beforeEach(async ({ page }) => {
      const folders: ModelFolderInfo[] = []
      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute(folders))
      )
      const jobs: JobsListResponse = {
        jobs: [],
        pagination: { offset: 0, limit: 200, total: 0, has_more: false }
      }
      await page.route('**/api/jobs?*', (route) =>
        route.fulfill(jsonRoute(jobs))
      )
    })

    test('keeps every link and scalar under its named slot across a reconcile, a resubscribe, and a reload', async ({
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      // The scenario's own assertions run inside the shared helper below;
      // this one confirms it completed rather than being rejected, which
      // both keeps a direct assertion in this test's own body (satisfying
      // `expect-expect`) and is itself the true/false signal the test cares
      // about.
      await expect(
        runMultiAutogrowRealignScenario(page, testInfo)
      ).resolves.toBeUndefined()
    })

    test('a corrupted persisted body fails the post-reload sentinel assertions, proving they read the saved GET response', async ({
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      await expect(
        runMultiAutogrowRealignScenario(page, testInfo, {
          corruptPersistedContent: true
        })
      ).resolves.toBeUndefined()
    })
  }
)
