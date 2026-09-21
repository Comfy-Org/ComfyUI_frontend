import { expect } from '@playwright/test'

import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import type {
  PromptResponse,
  UserDataFullInfo
} from '@/platform/remote/comfyui/types'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
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
 * and reconcile the same node in place, and once more after a full page
 * reload forces the same resubscribe from a cold start. It also proves the
 * PR's submitted-value guarantee: the reconcile must not just paint links
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

test.describe(
  'Agent CRDT multi-autogrow link realignment',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('keeps every link and scalar under its named slot across a reconcile, a resubscribe, and a reload', async ({
      page
    }) => {
      test.setTimeout(90_000)

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
        SOCKET_SID
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
      // most-recently-registered matching route first, so these have to
      // come after it to take over the workflow-save round trip.
      let savedName: string | undefined
      // Keyed by the full `workflows/<name>.json` path, and overwritten on
      // every save the same way `savedName` is -- a GET for that same path
      // is served this retained body instead of falling through to the
      // boot mock's empty response, so a reopen after `page.reload()`
      // actually reads back what was saved rather than discarding it.
      const savedWorkflowContent = new Map<string, string>()
      await page.route('**/api/userdata/*', (route) => {
        const request = route.request()
        const path = decodeURIComponent(
          new URL(request.url()).pathname.split('/userdata/')[1]
        )
        if (!path.startsWith('workflows/')) return route.fallback()
        if (request.method() === 'GET') {
          const content = savedWorkflowContent.get(path)
          return content === undefined
            ? route.fallback()
            : route.fulfill({ contentType: 'application/json', body: content })
        }
        if (request.method() !== 'POST') return route.fallback()
        savedName = path.slice('workflows/'.length, -'.json'.length)
        savedWorkflowContent.set(path, request.postData() ?? '{}')
        const saved: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        }
        return route.fulfill(jsonRoute(saved))
      })
      await page.route('**/api/workflows?*', (route) => {
        const workflows: WorkflowListResponse = {
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: WORKFLOW_ID,
                    name: savedName,
                    created_at: '2026-09-01T00:00:00Z',
                    updated_at: '2026-09-01T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      // Captures the exact body a real Run submits, keyed by node id ->
      // `{inputs}` -- a literal value under a scalar widget's own name, or
      // an `[originNodeId, originSlot]` tuple under a linked slot's own
      // name. Overwritten on every submit so re-running after the reload
      // step below reads that submission, not a stale one.
      let submittedPrompt: ComfyApiWorkflow | undefined
      await page.route('**/api/prompt', (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        const body = route.request().postDataJSON() as { prompt: unknown }
        // Parses against the same schema the real API prompt payload must
        // satisfy, so a drift in its shape fails loudly here instead of
        // silently passing or failing on the wrong field below.
        submittedPrompt = zComfyApiWorkflow.parse(body.prompt)
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
          await expect(
            vueNodes.getInputSlotRow(TARGET_ID, index)
          ).not.toHaveClass(/lg-slot--connected/)
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

      async function assertSubmittedValuesNamedCorrectly(): Promise<void> {
        const inputs = await runAndCaptureSubmission()
        expect(inputs.prompt).toBe(SENTINEL_PROMPT)
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

        const widthWidget = nodeLocator
          .getByLabel('width', { exact: true })
          .first()
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
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(1)
        await topbar.newWorkflowButton.click()
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(2)
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
        await expect.poll(() => hostSocket.subscribeCount()).toBe(2)

        await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible()
        await assertVisiblyCorrect()
      })

      await test.step('submitting the workflow serializes every scalar and link under its own name', async () => {
        await fillSentinelWidgetValues()
        await assertSubmittedValuesNamedCorrectly()
      })

      await test.step('saving persists the sentinel values to the userdata mock', async () => {
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
        await page.keyboard.press('Control+s')
        await saveResponse
      })

      await test.step('a full page reload forces the same resubscribe, and every link and value survive it', async () => {
        const subscribesBeforeReload = hostSocket.subscribeCount()
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
        await expect
          .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
          .toBeGreaterThan(subscribesBeforeReload)

        // Explicitly reopens the persisted workflow by its saved filename
        // through the same real `agentPanel.selectWorkflow` picker the
        // "target the workflow" step above used, instead of trusting
        // whatever tab happened to restore itself -- every assertion below
        // is then scoped to a workflow chosen by name, not by incidental
        // reload continuity.
        if (savedName === undefined) throw new Error('workflow was not saved')
        await agentPanel.selectWorkflow(savedName)

        await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible({
          timeout: 30_000
        })
        await assertVisiblyCorrect()

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
      })
    })
  }
)
