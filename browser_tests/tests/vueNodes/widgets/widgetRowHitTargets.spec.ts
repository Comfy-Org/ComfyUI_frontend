import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { findCoveredButtonPoints } from '@e2e/fixtures/utils/hitTestSweep'

for (const palette of ['dark', 'classic']) {
  test.describe(
    `Widget row hit targets in the ${palette} palette`,
    { tag: ['@vue-nodes', '@widget'] },
    () => {
      test.use({ initialSettings: { 'Comfy.ColorPalette': palette } })

      test('every enabled KSampler widget button receives clicks across its width', async ({
        comfyPage
      }) => {
        const [node] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
        await node.centerOnNode()
        const buttons = comfyPage.vueNodes
          .getNodeByTitle('KSampler')
          .getByTestId('node-widget')
          .getByRole('button', { disabled: false })
        await expect(buttons.first()).toBeVisible()

        expect(await findCoveredButtonPoints(buttons)).toEqual([])
      })
    }
  )
}
