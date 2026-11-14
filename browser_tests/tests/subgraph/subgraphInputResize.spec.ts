import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe(
  'Subgraph input node resizing',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('grows the native textarea with the input node while preserving its value', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const panel = comfyPage.subgraph.inputPanel
      const input = panel.getByRole('textbox', { name: 'text', exact: true })
      const sizes = () =>
        panel.or(input).evaluateAll((elements) =>
          elements.map((element) => ({
            width: element.clientWidth,
            height: element.clientHeight
          }))
        )
      await comfyPage.subgraph.fillInput('text', 'resized instance text')
      const before = await panel.boundingBox()
      const textBefore = await input.boundingBox()
      if (!before || !textBefore) {
        throw new Error('Expected the input node and native textarea')
      }

      await test.step('Drag the native southeast resize handle', async () => {
        await new VueNodeFixture(panel).resizeFromCorner('SE', 120, 100)
        await expect
          .poll(async () => (await panel.boundingBox())?.width)
          .toBeGreaterThan(before.width + 100)
        await expect
          .poll(async () => (await panel.boundingBox())?.height)
          .toBeGreaterThan(before.height + 80)
        await expect
          .poll(async () => (await input.boundingBox())?.width)
          .toBeGreaterThan(textBefore.width + 100)
        await expect
          .poll(async () => (await input.boundingBox())?.height)
          .toBeGreaterThan(textBefore.height + 80)
        await expect(input).toHaveValue('resized instance text')
      })

      await test.step('Saving and reloading preserves the node and textarea sizes', async () => {
        const resized = await sizes()
        await comfyPage.subgraph.exitViaBreadcrumb()
        await comfyPage.subgraph.serializeAndReload()
        await comfyPage.vueNodes.enterSubgraph('11')
        await expect.poll(sizes).toEqual(resized)
      })
    })
  }
)
