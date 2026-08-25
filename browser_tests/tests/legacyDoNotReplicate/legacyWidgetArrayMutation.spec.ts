import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'
import { toNodeId } from '@/types/nodeId'

test.describe('Legacy widget array mutation', { tag: '@vue-nodes' }, () => {
  test('Should display widgets in the order of the live widget array', async ({
    comfyPage
  }) => {
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)
    const nodeId = await legacyApi.addWidgetsForLegacyArrayReordering()
    await legacyApi.reorderWidgetsWithSplice(nodeId, [
      ['quoll-upload', 'saola-workflow'],
      ['olm-link', 'quoll-upload']
    ])

    await comfyPage.nextFrame()
    const orderedWidgets = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-widget')
      .filter({ hasText: /saola|quoll|olm|okapi|numbat/ })

    await expect(orderedWidgets).toContainText([
      'saola-workflow',
      'quoll-upload',
      'olm-link',
      'okapi-resolution',
      'numbat-stage'
    ])
  })

  test('Should hide removed widgets', async ({ comfyPage }) => {
    const nodeId = toNodeId(
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (node) => node.type === 'KSampler'
        )
        if (!node) throw new Error('KSampler node not found')
        return String(node.id)
      })
    )

    const widgets = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-widget')
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    await expect.poll(() => widgets.count()).toBeGreaterThanOrEqual(3)
    const initialCount = await widgets.count()
    expect(initialCount).toBeGreaterThanOrEqual(3)
    await legacyApi.removeLastWidgetWithPop(nodeId)
    await expect(widgets).toHaveCount(initialCount - 1)
    await legacyApi.removeLastWidgetByDecrementingLength(nodeId)
    await expect(widgets).toHaveCount(initialCount - 2)
    await legacyApi.removeFirstWidgetWithSplice(nodeId)
    await expect(widgets).toHaveCount(initialCount - 3)
  })
})
