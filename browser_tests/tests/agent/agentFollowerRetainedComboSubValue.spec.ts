import { expect } from '@playwright/test'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  comboAddressCatalog,
  comboAddressMessageId,
  comboAddressNodeId,
  comboAddressObjectInfo,
  comboAddressSeed,
  comboAddressThreadId,
  comboAddressWorkflowId,
  createDeliveryBarrierAdd,
  driftMarkerId,
  driftSubWidget,
  laterPromptValue,
  overflowMarkerId,
  promptValue,
  promptWidget,
  retainedMarkerId,
  retainedSubValue,
  retainedSubWidget,
  selectedSubValue,
  selectedSubWidget,
  selectorWidget,
  shortenedOverflowAlias
} from '@e2e/fixtures/data/agent/agentFollowerRetainedComboSubValue'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

test.describe(
  'Agent follower on a dynamic-combo sub-value the selection does not show',
  {
    tag: ['@cloud', '@agent', '@vue-nodes', '@widget'],
    annotation: [
      {
        type: 'source',
        description:
          'https://linear.app/comfyorg/issue/PM-2356/sentry-alert-on-cloud-frontend-prod-node-39-bytedance2referencenodev2'
      },
      {
        type: 'source',
        description:
          'https://linear.app/comfyorg/issue/PM-1932/sentry-alert-on-cloud-frontend-prod-node-8-bytedanceseedreamnodev3-has'
      }
    ]
  },
  () => {
    test('leaves the canvas alone without reporting a defect, and still reports real drift', async ({
      page
    }) => {
      test.setTimeout(90_000)

      const host = new HostDoc(
        comboAddressWorkflowId,
        comboAddressSeed,
        comboAddressCatalog
      )
      const hostSocket = new AgentFollowerHostSocket(
        page,
        comboAddressWorkflowId,
        host
      )
      await hostSocket.install()

      await bootAgentApp(page, true, {
        objectInfo: comboAddressObjectInfo,
        settings: { 'Comfy.Graph.CanvasInfo': false },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            thread_id: comboAddressThreadId,
            message_id: comboAddressMessageId,
            workflow_id: comboAddressWorkflowId
          })
          await mockWorkflowPersistence(page, comboAddressWorkflowId)
        }
      })

      const missingWidgetReports: string[] = []
      page.on('console', (message) => {
        if (/\bagent_graph_widget_missing(?!\w)/.test(message.text()))
          missingWidgetReports.push(message.text())
      })

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)

      await test.step('bind the workflow so the follower subscribes', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.sendMessage('hello')
        await expect(agentPanel.root.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: {
            message_id: comboAddressMessageId,
            thread_id: comboAddressThreadId
          }
        })
        await hostSocket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(comboAddressNodeId))
      await expect(node).toBeVisible()
      const prompt = vueNodes
        .getWidgetRowByLabel(node, promptWidget)
        .getByRole('textbox')
      const selectedSub = vueNodes
        .getWidgetRowByLabel(node, selectedSubWidget)
        .getByRole('textbox')

      await test.step('the node starts on its selected option', async () => {
        await expect(prompt).toHaveValue(promptValue)
        await expect(selectedSub).toHaveValue(selectedSubValue)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('the other option’s retained value changes nothing and is not reported', async () => {
        hostSocket.send(
          host.setDocumentWidget(
            comboAddressNodeId,
            `${selectorWidget}.${retainedSubWidget}`,
            retainedSubValue
          )
        )
        hostSocket.send(
          host.apply([createDeliveryBarrierAdd(retainedMarkerId)])
        )

        await expect(
          vueNodes.getNodeLocator(String(retainedMarkerId))
        ).toBeVisible()
        await expect(prompt).toHaveValue(promptValue)
        await expect(selectedSub).toHaveValue(selectedSubValue)
        await expect(node.getByText(retainedSubValue)).toHaveCount(0)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('and the node is not jammed: a later legitimate write still lands', async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: comboAddressNodeId,
              widget: promptWidget,
              value: laterPromptValue
            }
          ])
        )

        await expect(prompt).toHaveValue(laterPromptValue)
        await expect(selectedSub).toHaveValue(selectedSubValue)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('a positional alias past this selection’s widget list is not reported either', async () => {
        hostSocket.send(
          host.setDocumentWidget(
            comboAddressNodeId,
            shortenedOverflowAlias,
            retainedSubValue
          )
        )
        hostSocket.send(
          host.apply([createDeliveryBarrierAdd(overflowMarkerId)])
        )

        await expect(
          vueNodes.getNodeLocator(String(overflowMarkerId))
        ).toBeVisible()
        await expect(prompt).toHaveValue(laterPromptValue)
        await expect(selectedSub).toHaveValue(selectedSubValue)
        await expect(node.getByText(retainedSubValue)).toHaveCount(0)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('a sub-value no option owns is still reported, because that is catalog drift', async () => {
        hostSocket.send(
          host.setDocumentWidget(
            comboAddressNodeId,
            `${selectorWidget}.${driftSubWidget}`,
            retainedSubValue
          )
        )
        hostSocket.send(host.apply([createDeliveryBarrierAdd(driftMarkerId)]))

        await expect(
          vueNodes.getNodeLocator(String(driftMarkerId))
        ).toBeVisible()
        await expect(prompt).toHaveValue(laterPromptValue)
        await expect.poll(() => missingWidgetReports).not.toHaveLength(0)
      })
    })
  }
)
