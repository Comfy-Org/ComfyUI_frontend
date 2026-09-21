import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

for (const vueNodes of [false, true]) {
  test.describe(
    `WAS Pause live disabled getter (${vueNodes ? 'Vue' : 'classic'})`,
    { tag: vueNodes ? ['@vue-nodes', '@widget'] : ['@canvas', '@widget'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('Note')!
          node.title = 'WAS Pause compatibility'
          node.pos = [400, 200]
          node.widgets = []
          node.properties.resumed = false
          window.app!.graph.add(node)
          const held = new Set<string>()

          const button: IBaseWidget = {
            name: 'Resume',
            type: 'button',
            value: null,
            options: {},
            y: 0,
            callback: () => {
              if (button.disabled) return
              node.properties.resumed = true
            }
          }
          Object.defineProperty(button, 'disabled', {
            configurable: true,
            enumerable: true,
            get: () => !held.has(String(node.id)),
            set: () => {}
          })
          node.widgets.splice(0, 0, button)
          node.setSize(node.computeSize())
          node.setDirtyCanvas(true, true)
          window.addEventListener('was-pause', () => {
            held.add(String(node.id))
            node.color = '#7a5a1e'
            node.setDirtyCanvas(true, true)
          })
        })
        await comfyPage.nextFrame()
      })

      test('Resume becomes clickable when execution pauses', async ({
        comfyPage
      }) => {
        const node = await comfyPage.nodeOps.getNodeRefByTitle(
          'WAS Pause compatibility'
        )
        const resume = await node.getWidgetByName('Resume')
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: false })

        await comfyPage.page.evaluate(() =>
          window.dispatchEvent(new Event('was-pause'))
        )
        await comfyPage.nextFrame()

        if (vueNodes) {
          const button = comfyPage.vueNodes
            .getNodeLocator(node.id)
            .getByRole('button', { name: 'Resume', exact: true })
          await expect(button).toBeVisible()
          await expect(button).toBeEnabled()
          await button.click()
        } else {
          await resume.click()
        }
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: true })
      })
    }
  )
}
