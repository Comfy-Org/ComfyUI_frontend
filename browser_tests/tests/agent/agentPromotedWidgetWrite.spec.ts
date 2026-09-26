import { expect, mergeTests } from '@playwright/test'

import {
  PROMOTED_WIDGET_HOST_NODE_ID,
  PROMOTED_WIDGET_NEW_PROMPT,
  PROMOTED_WIDGET_NEW_STEPS,
  PROMOTED_WIDGET_PROMPT_NODE_ID,
  PROMOTED_WIDGET_SAMPLER_NODE_ID,
  PROMOTED_WIDGET_SUBGRAPH_TYPE,
  PROMOTED_WIDGET_WORKFLOW_LABEL,
  PROMOTED_WIDGET_WORKFLOW_NAME
} from '@e2e/fixtures/data/agent/promotedWidgetWrite'
import { promotedWidgetWriteFixture } from '@e2e/fixtures/promotedWidgetWriteFixture'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { webSocketFixture } from '@e2e/fixtures/ws'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

const test = mergeTests(agentTest, webSocketFixture, promotedWidgetWriteFixture)

function b64(u8: Uint8Array): string {
  return Buffer.from(u8).toString('base64')
}

test.describe(
  'Agent promoted widget write (QAF-36 / gm-34)',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('set_widget persists host promotions without changing interior defaults', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      getWebSocket,
      promotedWidgetWriteData
    }) => {
      test.setTimeout(60_000)
      const page = comfyPage.page
      const { fullState, delta, interiorPrompt, interiorWidth, interiorSteps } =
        promotedWidgetWriteData

      // agentPanelMocks stubs `/api/object_info` with `{}`. Routes match
      // last-registered-first, so registering the setup-API object_info route
      // here (after the fixture) wins and serves real node defs; without them
      // the subgraph host never materializes its promoted widgets.
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(page)
      try {
        await test.step('load the promoted-widget workflow', async () => {
          await comfyPage.workflow.reloadAndWaitForApp()
          await comfyPage.workflow.loadWorkflow(PROMOTED_WIDGET_WORKFLOW_NAME)
          await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)

          // Precondition: the host node exposes its promoted widgets before any
          // follower frame arrives. Guards against a silently-broken fixture
          // load.
          const hostWidgetsBefore = await page.evaluate((id) => {
            const host = window.app!.graph.getNodeById(id)
            return (host?.widgets ?? []).map((w) => [w.name, w.value])
          }, toNodeId(PROMOTED_WIDGET_HOST_NODE_ID))
          expect(hostWidgetsBefore).toEqual(
            expect.arrayContaining([['steps', interiorSteps]])
          )
          expect(hostWidgetsBefore.length).toBeGreaterThanOrEqual(7)
        })

        const panel =
          await test.step('point the agent panel at that workflow', async () => {
            await agentPanel.open()
            // The send is inert until the session has a workflow target:
            // `Send` is gated on `workflowSelecting || !composer.canSend.value`,
            // and the ack that carries `workflow_id` is what `bindWorkflow`
            // subscribes on. Asserting the picker is merely visible leaves the
            // panel unbound, so the click posts nothing and the CRDT leg below
            // is never reached.
            await agentPanel.selectWorkflow(PROMOTED_WIDGET_WORKFLOW_LABEL)
            await expect
              .poll(() =>
                page.evaluate(
                  (id) => window.app!.graph.getNodeById(id)?.type,
                  toNodeId(PROMOTED_WIDGET_HOST_NODE_ID)
                )
              )
              .toBe(PROMOTED_WIDGET_SUBGRAPH_TYPE)
            return agentPanel.root
          })

        const ws = await getWebSocket()
        // Resolve only a `doc_subscribe` that is proven to carry a string
        // workflow id. Accepting the frame on `type` alone lets a drifted
        // frame with missing or null `data` satisfy the promise, after which
        // every `doc_update` below is addressed to `undefined`.
        const subscribedWorkflowId = new Promise<string>((resolve) => {
          ws.onMessage((msg) => {
            if (typeof msg !== 'string') return
            let frame: unknown
            try {
              frame = JSON.parse(msg)
            } catch {
              return // not JSON, ignore
            }
            if (typeof frame !== 'object' || frame === null) return
            const { type, data } = frame as { type?: unknown; data?: unknown }
            if (
              type !== 'doc_subscribe' ||
              typeof data !== 'object' ||
              data === null
            )
              return
            const { workflow_id: workflowId } = data as {
              workflow_id?: unknown
            }
            if (typeof workflowId === 'string') resolve(workflowId)
          })
        })

        const workflowId =
          await test.step('send a turn and capture the document subscribe', async () => {
            const composer = panel.getByRole('textbox', {
              name: /^Describe ideas/
            })
            await composer.fill('set the prompt and steps')
            await panel.getByRole('button', { name: 'Send' }).click()
            await expect
              .poll(() => postedMessages.length)
              .toBeGreaterThanOrEqual(1)
            return subscribedWorkflowId
          })

        await test.step('deliver the mint and agent set_widget frames', () => {
          ws.send(
            JSON.stringify({
              type: 'doc_subscribed',
              data: { v: 1, workflow_id: workflowId, ok: true, seq: 0 }
            })
          )
          ws.send(
            JSON.stringify({
              type: 'doc_update',
              data: {
                v: 1,
                workflow_id: workflowId,
                seq: 0,
                actor: 'system:mint',
                update_b64: b64(fullState)
              }
            })
          )
          ws.send(
            JSON.stringify({
              type: 'doc_update',
              data: {
                v: 1,
                workflow_id: workflowId,
                seq: 1,
                actor: 'agent:test:1',
                op_ids: ['op-1', 'op-2'],
                update_b64: b64(delta)
              }
            })
          )
        })

        const readState = () =>
          page.evaluate(
            ({ hostId, promptId, samplerId }) => {
              const host = window.app!.graph.getNodeById(hostId)
              if (!host?.isSubgraphNode())
                throw new Error('Missing subgraph host')
              const hostWidgets = host.widgets.map((w) => [w.name, w.value])
              const interior = host.subgraph
              const prompt = interior.getNodeById(promptId)?.widgets?.[0]?.value
              const steps = interior
                .getNodeById(samplerId)
                ?.widgets?.find((w) => w.name === 'steps')?.value
              return { hostWidgets, prompt, steps }
            },
            {
              hostId: toNodeId(PROMOTED_WIDGET_HOST_NODE_ID),
              promptId: toNodeId(PROMOTED_WIDGET_PROMPT_NODE_ID),
              samplerId: toNodeId(PROMOTED_WIDGET_SAMPLER_NODE_ID)
            }
          )

        const state =
          await test.step('the write lands on the host, not on the interior defaults', async () => {
            await expect
              .poll(async () => {
                const s = await readState()
                return s.hostWidgets
              })
              .toEqual(
                expect.arrayContaining([
                  ['text', PROMOTED_WIDGET_NEW_PROMPT],
                  ['steps', PROMOTED_WIDGET_NEW_STEPS],
                  ['width', interiorWidth]
                ])
              )

            const state = await readState()
            expect(state.prompt).toBe(interiorPrompt)
            expect(state.steps).toBe(interiorSteps)
            return state
          })

        await test.step('the write survives save and reload', async () => {
          const saved = await page.evaluate(() => window.app!.graph.serialize())
          const validatedSave = await validateComfyWorkflow(saved)
          if (!validatedSave) throw new Error('Invalid saved workflow')
          await comfyPage.workflow.loadGraphData(validatedSave)
          await expect.poll(readState).toEqual(state)
        })
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
