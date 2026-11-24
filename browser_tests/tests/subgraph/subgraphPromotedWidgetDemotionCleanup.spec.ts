import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Promoted widget host value across a re-promotion (#14495)',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('keeps the host edit when the interior link is detached and promoted again later', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      const host = comfyPage.vueNodes.getNodeLocator('2')
      const hostWidget = host.getByLabel('steps', { exact: true })

      await test.step('Promote the interior widget and edit it on the host', async () => {
        await comfyPage.vueNodes.enterSubgraph('2')
        await comfyPage.subgraph.promoteWidget(
          comfyPage.vueNodes.getNodeByTitle('KSampler'),
          'steps'
        )
        await comfyPage.subgraph.exitViaBreadcrumb()

        await comfyPage.vueNodes.setInputNumberValue(hostWidget, '13')
      })

      await test.step('Detach the interior link and leave the subgraph', async () => {
        await comfyPage.vueNodes.enterSubgraph('2')
        const ksampler = await comfyPage.nodeOps.getNodeRefById('1')
        await comfyPage.subgraph.detachPromotedInput(ksampler, 'steps')
        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(host).toBeVisible()
        await expect(hostWidget).toBeHidden()
      })

      await test.step('Promote the same slot again', async () => {
        await comfyPage.vueNodes.enterSubgraph('2')
        const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        const fromSlot = ksampler.getSlot('steps')
        const toPosition = await comfyPage.subgraph
          .getInputSlot('steps')
          .getPosition()
        await fromSlot.dragTo(comfyPage.canvas, { targetPosition: toPosition })
        await expect
          .poll(() => comfyPage.vueNodes.isSlotConnected(fromSlot))
          .toBe(true)
        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(hostWidget).toBeVisible()
        await expect(
          comfyPage.vueNodes.getInputNumberControls(hostWidget).input
        ).toHaveValue('13')
      })
    })
  }
)
