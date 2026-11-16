import { expect } from '@playwright/test'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  absentDottedWidget,
  absentOverflowAlias,
  createDeliveryBarrierAdd,
  dottedMarkerId,
  keptValue,
  keptWidget,
  laterValue,
  missingWidgetCatalog,
  missingWidgetMessageId,
  missingWidgetNodeId,
  missingWidgetObjectInfo,
  missingWidgetSeed,
  missingWidgetThreadId,
  missingWidgetWorkflowId,
  otherDefault,
  otherWidget,
  overflowMarkerId,
  refusedValue
} from '@e2e/fixtures/data/agent/agentFollowerMissingWidgetRefusal'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

test.describe(
  'Agent follower on a widget address the live node does not have',
  {
    tag: ['@cloud', '@agent', '@vue-nodes', '@widget'],
    annotation: {
      type: 'source',
      description:
        'https://linear.app/comfyorg/issue/PM-2356/sentry-alert-on-cloud-frontend-prod-node-39-bytedance2referencenodev2'
    }
  },
  () => {
    test('refuses the write, leaves the visible values alone, and stays usable', async ({
      page
    }) => {
      test.setTimeout(90_000)

      const host = new HostDoc(
        missingWidgetWorkflowId,
        missingWidgetSeed,
        missingWidgetCatalog
      )
      const hostSocket = new AgentFollowerHostSocket(
        page,
        missingWidgetWorkflowId,
        host
      )
      await hostSocket.install()

      await bootAgentApp(page, true, {
        objectInfo: missingWidgetObjectInfo,
        settings: { 'Comfy.Graph.CanvasInfo': false },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            thread_id: missingWidgetThreadId,
            message_id: missingWidgetMessageId,
            workflow_id: missingWidgetWorkflowId
          })
          await mockWorkflowPersistence(page, missingWidgetWorkflowId)
        }
      })

      const refusalReports: string[] = []
      page.on('console', (message) => {
        if (/\bagent_graph_widget_missing(?!\w)/.test(message.text()))
          refusalReports.push(message.text())
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
            message_id: missingWidgetMessageId,
            thread_id: missingWidgetThreadId
          }
        })
        await hostSocket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(missingWidgetNodeId))
      await expect(node).toBeVisible()
      const keptInput = node.getByRole('textbox', { name: keptWidget })
      const otherInput = node.getByRole('textbox', { name: otherWidget })

      await test.step('the node starts on its own values', async () => {
        await expect(keptInput).toHaveValue(keptValue)
        await expect(otherInput).toHaveValue(otherDefault)
        expect(refusalReports).toHaveLength(0)
      })

      await test.step('a dotted address the node does not carry changes nothing on the canvas', async () => {
        hostSocket.send(
          host.setDocumentWidget(
            missingWidgetNodeId,
            absentDottedWidget,
            refusedValue
          )
        )
        hostSocket.send(host.apply([createDeliveryBarrierAdd(dottedMarkerId)]))

        await expect(
          vueNodes.getNodeLocator(String(dottedMarkerId))
        ).toBeVisible()
        await expect(keptInput).toHaveValue(keptValue)
        await expect(otherInput).toHaveValue(otherDefault)
        await expect(node.getByText(refusedValue)).toHaveCount(0)
        await expect.poll(() => refusalReports).not.toHaveLength(0)
      })

      await test.step('and the refusal does not jam the node: a later legitimate write still lands', async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: missingWidgetNodeId,
              widget: keptWidget,
              value: laterValue
            }
          ])
        )

        await expect(keptInput).toHaveValue(laterValue)
        await expect(otherInput).toHaveValue(otherDefault)
      })

      await test.step('a positional alias past the live widget list is refused the same way', async () => {
        hostSocket.send(
          host.setDocumentWidget(
            missingWidgetNodeId,
            absentOverflowAlias,
            refusedValue
          )
        )
        hostSocket.send(
          host.apply([createDeliveryBarrierAdd(overflowMarkerId)])
        )

        await expect(
          vueNodes.getNodeLocator(String(overflowMarkerId))
        ).toBeVisible()
        await expect(otherInput).toHaveValue(otherDefault)
        await expect(keptInput).toHaveValue(laterValue)
        await expect(node.getByText(refusedValue)).toHaveCount(0)
        await expect.poll(() => refusalReports.length).toBeGreaterThan(1)
      })
    })
  }
)
