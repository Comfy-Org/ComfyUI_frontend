import { expect, mergeTests } from '@playwright/test'

import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  cleanupFakeModel,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { agentTest, pushAgentEvent } from '@e2e/tests/agent/agentPanelMocks'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent catalog refresh clears resolved model warnings',
  { tag: ['@agent', '@ui', '@node', '@widget'] },
  () => {
    test.use({
      connectWebSocketToServer: false,
      initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true },
      objectInfo: 'server'
    })

    test.beforeEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test(
      'removes the stale missing-model warning after refresh_catalog succeeds',
      {
        annotation: {
          type: 'source',
          description:
            'https://comfy-organization.slack.com/archives/C0BGH348Z0C/p1792786656089399'
        }
      },
      async ({ agentPanel, comfyPage, getAgentSocket }) => {
        const page = comfyPage.page
        const missingModelsGroup = page.getByTestId(
          TestIds.dialogs.missingModelsGroup
        )

        await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')
        await expect(missingModelsGroup).toBeVisible()

        await page.route(/\/object_info$/, async (route) => {
          const response = await route.fetch()
          const objectInfo: ObjectInfoResponse = await response.json()
          const ckptName =
            objectInfo.CheckpointLoaderSimple.input?.required?.ckpt_name
          if (!ckptName) throw new Error('Missing ckpt_name input')
          const choices = ckptName[0]
          if (!Array.isArray(choices)) throw new Error('Invalid ckpt_name enum')
          ckptName[0] = [...choices, 'fake_model.safetensors']
          await route.fulfill({ response, json: objectInfo })
        })

        await agentPanel.open()
        const ws = await getAgentSocket()
        const objectInfoResponse = page.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.pathname.endsWith('/object_info') && response.ok()
        })
        const catalogRefreshed: AgentWsEvent = {
          type: 'agent_tool_call',
          data: {
            tool_call_id: 'call-refresh-catalog-browser-proof',
            tool_name: 'refresh_catalog',
            status: 'success',
            message_id: 'message-refresh-catalog-browser-proof',
            thread_id: 'thread-refresh-catalog-browser-proof'
          }
        }

        pushAgentEvent(ws, catalogRefreshed)
        await objectInfoResponse
        const propertiesPanel = new PropertiesPanelHelper(page)
        await propertiesPanel.open(comfyPage.actionbar.propertiesButton)

        await expect(propertiesPanel.errorsTab).toBeHidden()
        await expect(missingModelsGroup).toBeHidden()
      }
    )
  }
)
