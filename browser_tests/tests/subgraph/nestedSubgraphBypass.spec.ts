import { mergeTests } from '@playwright/test'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

interface QueuePromptRequestBody {
  prompt: ComfyApiWorkflow
}

wstest.describe(
  'Nested subgraph prompt serialization',
  {
    tag: ['@slow', '@subgraph', '@vue-nodes']
  },
  () => {
    wstest(
      'excludes contents of a bypassed nested subgraph from the queued prompt',
      async ({ comfyPage, getWebSocket }) => {
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())

        await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')

        await comfyPage.subgraph.enterSubgraphWithFallback('10')

        const innerHostId =
          await comfyPage.vueNodes.getNodeIdByTitle('subgraph 3')
        const innerHost = await comfyPage.nodeOps.getNodeRefById(innerHostId)
        await expect(innerHost).not.toBeBypassed()

        const innerFixture =
          await comfyPage.vueNodes.getFixtureByTitle('subgraph 3')
        await comfyPage.contextMenu.openForVueNode(innerFixture.header)
        await comfyPage.contextMenu.clickMenuItemExact('Bypass')
        await expect(innerHost).toBeBypassed()

        await comfyPage.subgraph.exitViaBreadcrumb()

        let promptKeys: string[] = []
        await execution.run({
          onPromptRequest: (body) => {
            const request = body as QueuePromptRequestBody
            promptKeys = Object.keys(request.prompt)
          }
        })

        expect(promptKeys.sort()).toEqual(['10:3', '10:6', '8', '9'])
      }
    )
  }
)
