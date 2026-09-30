import { mergeTests } from '@playwright/test'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  getPromotedWidgetNames,
  setPromotedHostWidgetValue
} from '@e2e/fixtures/utils/promotedWidgets'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

interface QueuePromptRequestBody {
  prompt: ComfyApiWorkflow
}

test.describe(
  'Socket-less widget promotion on the host node',
  {
    tag: ['@subgraph', '@widget']
  },
  () => {
    test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

    wstest(
      'KSampler control_after_generate promotes to the host and randomizes the seed',
      async ({ comfyPage, getWebSocket }) => {
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())

        await comfyPage.workflow.loadWorkflow('default')

        const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
        await kSampler.centerOnNode()
        await kSampler.click('title')
        const host = await kSampler.convertToSubgraph()
        const hostId = String(host.id)

        await host.navigateIntoSubgraph()

        const innerKSampler = await comfyPage.nodeOps.getNodeRefById('3')
        const controlWidget = await innerKSampler.getWidgetByName(
          'control_after_generate'
        )
        const widgetPos = await controlWidget.getPosition()
        await comfyPage.canvasOps.mouseClickAt(widgetPos, { button: 'right' })

        const promoteEntry = comfyPage.page
          .locator('.litemenu-entry')
          .filter({ hasText: 'Promote Widget: control after generate' })
        await expect(promoteEntry).toBeVisible()
        await promoteEntry.click()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect
          .poll(() => getPromotedWidgetNames(comfyPage, hostId))
          .toContain('control_after_generate')

        await setPromotedHostWidgetValue(
          comfyPage,
          toNodeId(hostId),
          'control_after_generate',
          'randomize'
        )

        let promptKeys: string[] = []
        await execution.run({
          onPromptRequest: (body) => {
            const request = body as QueuePromptRequestBody
            promptKeys = Object.keys(request.prompt)
          }
        })
        expect(promptKeys).toContain(`${hostId}:3`)
        expect(promptKeys).not.toContain('3')

        const hostSeed = await comfyPage.page.evaluate((id) => {
          const node = window.app!.canvas.graph!.getNodeById(id as NodeId)!
          return node.widgets?.find((w) => w.name === 'seed')?.value
        }, hostId)
        expect(typeof hostSeed).toBe('number')
        expect(hostSeed).not.toBe(156680208700286)
      }
    )
  }
)

wstest(
  'Promoted multiline text widget on the host node reaches the prompt',
  { tag: ['@vue-nodes', '@subgraph'] },
  async ({ comfyPage, getWebSocket }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    await comfyPage.workflow.loadWorkflow('default')

    const clipEncode = await comfyPage.nodeOps.getNodeRefById('7')
    await clipEncode.click('title')
    const host = await clipEncode.convertToSubgraph()
    const hostId = String(host.id)

    const textWidget = comfyPage.vueNodes
      .getNodeLocator(hostId)
      .getByLabel('text', { exact: true })
    await textWidget.fill('promoted host text')

    let promptKeys: string[] = []
    let clipText: unknown
    await execution.run({
      onPromptRequest: (body) => {
        const request = body as QueuePromptRequestBody
        promptKeys = Object.keys(request.prompt)
        clipText = request.prompt[`${hostId}:7`]?.inputs.text
      }
    })

    expect(promptKeys).toContain(`${hostId}:7`)
    expect(promptKeys).not.toContain('7')
    expect(clipText).toBe('promoted host text')
  }
)
