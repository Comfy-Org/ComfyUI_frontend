import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

const HOST_NODE_ID = '2'
const INTERIOR_KSAMPLER_ID = '1'
const PROMOTED_WIDGET = 'steps'
const HOST_EDIT = '13'

async function getInputSlotIndex(
  comfyPage: ComfyPage,
  nodeId: string,
  inputName: string
): Promise<number> {
  return await comfyPage.page.evaluate(
    ([id, name]) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      if (!node) throw new Error(`Node ${id} not found`)
      const index = node.inputs.findIndex((input) => input.name === name)
      if (index === -1) throw new Error(`Input '${name}' not found on ${id}`)
      return index
    },
    [toNodeId(nodeId), inputName] as const
  )
}

test.describe(
  'Promoted widget host value across a re-promotion (#14495)',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('keeps the host edit when the interior link is detached and promoted again later', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      const host = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
      const hostWidget = host.getByLabel(PROMOTED_WIDGET, { exact: true })

      await test.step('Promote the interior widget and edit it on the host', async () => {
        await comfyPage.vueNodes.enterSubgraph(HOST_NODE_ID)
        await comfyPage.subgraph.promoteWidget(
          comfyPage.vueNodes.getNodeByTitle('KSampler'),
          PROMOTED_WIDGET
        )
        await comfyPage.subgraph.exitViaBreadcrumb()

        await comfyPage.vueNodes.setInputNumberValue(hostWidget, HOST_EDIT)
      })

      await test.step('Detach the interior link and leave the subgraph', async () => {
        await comfyPage.vueNodes.enterSubgraph(HOST_NODE_ID)
        const ksampler =
          await comfyPage.nodeOps.getNodeRefById(INTERIOR_KSAMPLER_ID)
        const slotIndex = await getInputSlotIndex(
          comfyPage,
          INTERIOR_KSAMPLER_ID,
          PROMOTED_WIDGET
        )
        const slot = await ksampler.getInput(slotIndex)
        await slot.removeLinks()
        await comfyPage.nextFrame()
        await slot.expectLinkCount(0, 'Interior link should be detached')
        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(host).toBeVisible()
        await expect(hostWidget).toBeHidden()
      })

      await test.step('Promote the same slot again', async () => {
        await comfyPage.vueNodes.enterSubgraph(HOST_NODE_ID)
        // Drag from the interior widget's own slot dot rather than from a
        // litegraph slot index: in Vue-node mode the index geometry lands on
        // the neighbouring socket and silently promotes the wrong widget.
        const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        const fromSlot = ksampler.getSlot(PROMOTED_WIDGET)
        const toPosition = await comfyPage.subgraph
          .getInputSlot(PROMOTED_WIDGET)
          .getPosition()
        await fromSlot.dragTo(comfyPage.canvas, { targetPosition: toPosition })
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(fromSlot))
          .toBe(true)
        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(hostWidget).toBeVisible()
        await expect(
          comfyPage.vueNodes.getInputNumberControls(hostWidget).input
        ).toHaveValue(HOST_EDIT)
      })
    })
  }
)
