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
import { webSocketFixture } from '@e2e/fixtures/ws'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

const test = mergeTests(agentTest, webSocketFixture, promotedWidgetWriteFixture)

test.describe(
  'Agent promoted widget write (QAF-36 / gm-34)',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false, objectInfo: 'server' })

    test('set_widget persists host promotions without changing interior defaults', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      getWebSocket,
      promotedWidgetWriteData,
      promotedWidgetWriteHost
    }) => {
      test.setTimeout(60_000)
      const page = comfyPage.page
      const { framesFor, interiorPrompt, interiorSteps } =
        promotedWidgetWriteData

      const hostWidgetsBefore =
        await test.step('load the promoted-widget workflow', async () => {
          await comfyPage.workflow.loadWorkflow(PROMOTED_WIDGET_WORKFLOW_NAME)

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
          return hostWidgetsBefore
        })

      await test.step('point the agent panel at that workflow', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow(PROMOTED_WIDGET_WORKFLOW_LABEL)
        await expect
          .poll(() =>
            page.evaluate(
              (id) => window.app!.graph.getNodeById(id)?.type,
              toNodeId(PROMOTED_WIDGET_HOST_NODE_ID)
            )
          )
          .toBe(PROMOTED_WIDGET_SUBGRAPH_TYPE)
      })

      const ws = await getWebSocket()
      const subscribedWorkflowId = promotedWidgetWriteHost.waitForSubscribe(ws)

      const workflowId =
        await test.step('send a turn and capture the document subscribe', async () => {
          await agentPanel.sendMessage('set the prompt and steps')
          await expect
            .poll(() => postedMessages.length)
            .toBeGreaterThanOrEqual(1)
          return subscribedWorkflowId
        })

      await test.step('deliver the mint and agent set_widget frames', () => {
        const [subscribed, minted, updated] = framesFor(workflowId)
        ws.send(JSON.stringify(subscribed))
        ws.send(JSON.stringify(minted))
        ws.send(JSON.stringify(updated))
      })

      async function readState() {
        return page.evaluate(
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
      }

      const state =
        await test.step('the write lands on the host, not on the interior defaults', async () => {
          const expectedHostWidgets = hostWidgetsBefore.map(([name, value]) => [
            name,
            name === 'text'
              ? PROMOTED_WIDGET_NEW_PROMPT
              : name === 'steps'
                ? PROMOTED_WIDGET_NEW_STEPS
                : value
          ])
          await expect
            .poll(async () => {
              const s = await readState()
              return s.hostWidgets
            })
            .toEqual(expectedHostWidgets)

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
    })
  }
)
