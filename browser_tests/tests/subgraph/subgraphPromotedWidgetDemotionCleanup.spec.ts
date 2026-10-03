import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

// Companion coverage for #14495, whose own regression case
// (subgraphPromotion.spec.ts, "Promoted STRING widget edit survives a rebind of
// the interior link") rebinds inside one helper call. This one takes the link
// away, leaves the subgraph, comes back and re-promotes -- many ticks and a
// navigation apart -- because that wider gap is what reviewers of the
// cloud/1.54 carrier for #18074 (#19750) read as a genuine disconnect that
// should discard the host's widget state. Discarding it is what #14495 filed:
// the value typed on the host reverts to the interior node's older one.
//
// Red against that proposed change, green on main.
const HOST_NODE_ID = '2'
const INTERIOR_KSAMPLER_ID = '1'
const PROMOTED_WIDGET = 'steps'
const INTERIOR_VALUE = '20'
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

        await expect(hostWidget).toBeVisible()
        await expect(
          comfyPage.vueNodes.getInputNumberControls(hostWidget).input
        ).toHaveValue(INTERIOR_VALUE)

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
