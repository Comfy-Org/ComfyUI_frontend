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
  absentMarkerId,
  absentWidget,
  controlMarkerId,
  controlWidget,
  createDeliveryBarrierAdd,
  labelValue,
  labelWidget,
  laterLabelValue,
  packSeedNodeId,
  packSeedNodeType,
  refusedMode,
  removeControlInOnNodeCreated,
  removedSeedControlCatalog,
  removedSeedControlMessageId,
  removedSeedControlObjectInfo,
  removedSeedControlSeed,
  removedSeedControlThreadId,
  removedSeedControlWorkflowId,
  seedValue,
  seedWidget
} from '@e2e/fixtures/data/agent/agentFollowerRemovedSeedControl'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

test.describe(
  'Agent follower on a seed control the node pack removed on purpose',
  {
    tag: ['@cloud', '@agent', '@vue-nodes', '@widget'],
    annotation: {
      type: 'source',
      description: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/24049'
    }
  },
  () => {
    test('stays quiet about the removed control while a real missing widget is still reported', async ({
      page
    }) => {
      test.setTimeout(90_000)

      const host = new HostDoc(
        removedSeedControlWorkflowId,
        removedSeedControlSeed,
        removedSeedControlCatalog
      )
      const hostSocket = new AgentFollowerHostSocket(
        page,
        removedSeedControlWorkflowId,
        host
      )
      await hostSocket.install()

      await bootAgentApp(page, true, {
        objectInfo: removedSeedControlObjectInfo,
        settings: { 'Comfy.Graph.CanvasInfo': false },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            thread_id: removedSeedControlThreadId,
            message_id: removedSeedControlMessageId,
            workflow_id: removedSeedControlWorkflowId
          })
          await mockWorkflowPersistence(page, removedSeedControlWorkflowId)
        }
      })

      await page.evaluate(removeControlInOnNodeCreated, {
        nodeTypeName: packSeedNodeType,
        controlName: controlWidget
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
        await agentPanel.sendMessage('hello')
        await expect(agentPanel.root.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: {
            message_id: removedSeedControlMessageId,
            thread_id: removedSeedControlThreadId
          }
        })
        await hostSocket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(packSeedNodeId))
      await expect(node).toBeVisible()
      const seedInput = node.getByRole('spinbutton', {
        name: seedWidget,
        exact: true
      })
      const labelInput = node.getByRole('textbox', { name: labelWidget })

      await test.step('catch-up applies the values the node does have, silently', async () => {
        await expect(seedInput).toHaveValue(seedValue)
        await expect(labelInput).toHaveValue(labelValue)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('an edit to the control the pack removed is dropped without a report', async () => {
        hostSocket.send(
          host.setDocumentWidget(packSeedNodeId, controlWidget, refusedMode)
        )
        hostSocket.send(host.apply([createDeliveryBarrierAdd(controlMarkerId)]))

        await expect(
          vueNodes.getNodeLocator(String(controlMarkerId))
        ).toBeVisible()
        await expect(seedInput).toHaveValue(seedValue)
        await expect(labelInput).toHaveValue(labelValue)
        await expect(node.getByText(refusedMode)).toHaveCount(0)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('and the node is not jammed: a later legitimate write still lands', async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: packSeedNodeId,
              widget: labelWidget,
              value: laterLabelValue
            }
          ])
        )

        await expect(labelInput).toHaveValue(laterLabelValue)
        expect(missingWidgetReports).toHaveLength(0)
      })

      await test.step('positive control: a widget the node really lacks is still reported', async () => {
        hostSocket.send(host.setDocumentWidget(packSeedNodeId, absentWidget, 8))
        hostSocket.send(host.apply([createDeliveryBarrierAdd(absentMarkerId)]))

        await expect(
          vueNodes.getNodeLocator(String(absentMarkerId))
        ).toBeVisible()
        await expect(labelInput).toHaveValue(laterLabelValue)
        await expect.poll(() => missingWidgetReports).not.toHaveLength(0)
      })
    })
  }
)
