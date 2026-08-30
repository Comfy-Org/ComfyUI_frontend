import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Legacy widget visibility mutation',
  { tag: '@vue-nodes' },
  () => {
    test('reacts to options.hidden writes and deletes', async ({
      comfyPage
    }) => {
      const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      await expect(widget).toBeVisible()
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')
        widget.options.hidden = true
      })
      await expect(widget).toBeHidden()

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')
        delete widget.options.hidden
      })
      await expect(widget).toBeVisible()
    })

    test('reacts to legacy hidden type mutations', async ({ comfyPage }) => {
      const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      await expect(widget).toBeVisible()
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')
        widget.type = 'tschide_number'
      })
      await expect(widget).toBeHidden()

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')
        widget.type = 'number'
      })
      await expect(widget).toBeVisible()
    })
  }
)
