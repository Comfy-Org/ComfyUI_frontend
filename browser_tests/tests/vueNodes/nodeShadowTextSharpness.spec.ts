import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const NO_NODE_SHADOW = '.lg-node { filter: none; box-shadow: none; }'

test.describe(
  'Vue node shadow keeps node text sharp',
  { tag: ['@vue-nodes', '@firefox'] },
  () => {
    for (const scale of [0.75, 0.83]) {
      test(`title pixels are unchanged by the shadow at canvas ${scale}`, async ({
        comfyPage
      }) => {
        await comfyPage.canvasOps.setScale(scale)
        const title = comfyPage.vueNodes
          .getNodeByTitle('Load Checkpoint')
          .getByTestId('node-title')

        const withShadow = await title.screenshot()
        await comfyPage.page.addStyleTag({ content: NO_NODE_SHADOW })
        await comfyPage.nextFrame()
        const withoutShadow = await title.screenshot()

        expect(
          withShadow.equals(withoutShadow),
          'node title pixels with and without the node shadow'
        ).toBe(true)
      })
    }
  }
)
