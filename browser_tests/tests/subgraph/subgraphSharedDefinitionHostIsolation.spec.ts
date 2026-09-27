import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph shared-definition host isolation',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('Rebinding a promoted input does not leak a host edit into a sibling host', async ({
      comfyPage
    }) => {
      const hostAId = '11'
      const hostBId = '12'
      const hostAValue = 'host-a-edit'
      const hostBValue = 'host-b-edit'

      const promotedTextarea = (nodeId: string) =>
        comfyPage.vueNodes
          .getNodeLocator(nodeId)
          .getByRole('textbox', { name: 'text' })

      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.waitForNodes()

      const hostA = await comfyPage.nodeOps.getNodeRefById(hostAId)
      const hostB = await comfyPage.nodeOps.getNodeRefById(hostBId)
      const hostAType = await hostA.getType()
      expect(
        await hostB.getType(),
        'Both hosts must instantiate the same subgraph definition'
      ).toBe(hostAType)

      await promotedTextarea(hostAId).fill(hostAValue)
      await promotedTextarea(hostBId).fill(hostBValue)
      await expect(promotedTextarea(hostAId)).toHaveValue(hostAValue)
      await expect(promotedTextarea(hostBId)).toHaveValue(hostBValue)

      await comfyPage.vueNodes.enterSubgraph(hostAId)
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      const interiorNodes = await comfyPage.nodeOps.getNodeRefsByType(
        'CLIPTextEncode',
        true
      )
      expect(
        interiorNodes,
        'Expected exactly one interior CLIPTextEncode'
      ).toHaveLength(1)

      await comfyPage.subgraph.rebindPromotedInput(interiorNodes[0], 'text')

      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.vueNodes.waitForNodes()

      await expect(promotedTextarea(hostAId)).toBeVisible()
      await expect(promotedTextarea(hostBId)).toBeVisible()

      await expect(
        promotedTextarea(hostAId),
        'Host A must not adopt the sibling host edit'
      ).not.toHaveValue(hostBValue)
      await expect(
        promotedTextarea(hostBId),
        'Host B must not adopt the sibling host edit'
      ).not.toHaveValue(hostAValue)
    })
  }
)
