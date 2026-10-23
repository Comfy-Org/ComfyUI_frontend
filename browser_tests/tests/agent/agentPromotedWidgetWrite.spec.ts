import { expect } from '@playwright/test'

import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  PROMOTED_WIDGET_HOST_NODE_ID,
  PROMOTED_WIDGET_NEW_PROMPT,
  PROMOTED_WIDGET_NEW_STEPS,
  PROMOTED_WIDGET_PROMPT_NODE_ID,
  PROMOTED_WIDGET_SAMPLER_NODE_ID,
  PROMOTED_WIDGET_SUBGRAPH_TYPE,
  createPromotedWidgetWriteData
} from '@e2e/fixtures/data/agent/promotedWidgetWrite'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'

const WORKFLOW_ID = '17412000-0000-4000-8000-000000000001'
const MESSAGE_ID = '17412000-0000-4000-8000-000000000002'
const THREAD_ID = '17412000-0000-4000-8000-000000000003'

test.describe(
  'Agent promoted widget write (QAF-36 / gm-34)',
  { tag: '@cloud' },
  () => {
    test('set_widget persists host promotions without changing interior defaults', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(60_000)
      const data = createPromotedWidgetWriteData()
      expect(data.catalog.types).not.toHaveProperty(
        PROMOTED_WIDGET_SUBGRAPH_TYPE
      )
      const host = new HostDoc(WORKFLOW_ID, data.seed, data.catalog)
      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
      await hostSocket.install()

      await bootAgentApp(page, agentFlagEnabled, {
        objectInfo: 'server',
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })
      await loadSeedIntoActiveTab(page, data.seed)

      const hostWidgetsBefore = await page.evaluate((id) => {
        const host = window.app!.graph.getNodeById(id)
        return (host?.widgets ?? []).map((widget) => [
          widget.name,
          widget.value
        ])
      }, toNodeId(PROMOTED_WIDGET_HOST_NODE_ID))
      expect(
        hostWidgetsBefore.map(([name]) => name),
        'the fixture must expose every promoted host widget'
      ).toEqual([
        'text',
        'width',
        'height',
        'unet_name',
        'clip_name',
        'vae_name',
        'steps'
      ])
      expect(hostWidgetsBefore).toEqual(
        expect.arrayContaining([
          ['text', data.interiorPrompt],
          ['steps', data.interiorSteps]
        ])
      )

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('set the prompt and steps')
      await agentPanel.expectUserMessages(['set the prompt and steps'])
      await hostSocket.waitForSubscribe()
      hostSocket.send(host.apply(data.operations))

      async function readState() {
        return page.evaluate(
          ({ hostId, promptId, samplerId }) => {
            const host = window.app!.graph.getNodeById(hostId)
            if (!host?.isSubgraphNode()) return null
            const hostWidgets = host.widgets.map((widget) => [
              widget.name,
              widget.value
            ])
            const prompt =
              host.subgraph.getNodeById(promptId)?.widgets?.[0]?.value
            const steps = host.subgraph
              .getNodeById(samplerId)
              ?.widgets?.find((widget) => widget.name === 'steps')?.value
            return { hostWidgets, prompt, steps }
          },
          {
            hostId: toNodeId(PROMOTED_WIDGET_HOST_NODE_ID),
            promptId: toNodeId(PROMOTED_WIDGET_PROMPT_NODE_ID),
            samplerId: toNodeId(PROMOTED_WIDGET_SAMPLER_NODE_ID)
          }
        )
      }

      const expectedHostWidgets = hostWidgetsBefore.map(([name, value]) => [
        name,
        name === 'text'
          ? PROMOTED_WIDGET_NEW_PROMPT
          : name === 'steps'
            ? PROMOTED_WIDGET_NEW_STEPS
            : value
      ])
      const expectedState = {
        hostWidgets: expectedHostWidgets,
        prompt: data.interiorPrompt,
        steps: data.interiorSteps
      }

      await test.step('the write lands on the host, not on the interior defaults', async () => {
        await expect.poll(readState).toEqual(expectedState)
      })

      await test.step('the write survives a graph serialization round trip', async () => {
        const serialized = await page.evaluate(() =>
          window.app!.graph.serialize()
        )
        const validated = await validateComfyWorkflow(serialized)
        if (!validated) throw new Error('Invalid serialized workflow')
        await loadIntoBootWorkflow(page, validated)
        await expect.poll(readState).toEqual(expectedState)
      })
    })
  }
)
