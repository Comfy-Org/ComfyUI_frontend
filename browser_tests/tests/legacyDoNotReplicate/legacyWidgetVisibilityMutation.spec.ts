import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe(
  'Legacy widget visibility mutation',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    test('keeps widget.hidden reactive without dropping its serialized value', async ({
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

        widget.value = 37
        widget.hidden = true
      })
      await comfyPage.nextFrame()

      await expect(widget).toBeHidden()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.type === 'KSampler'
            )
            return node?.serialize().widgets_values_named?.steps
          })
        )
        .toBe(37)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        widget.hidden = false
      })
      await comfyPage.nextFrame()

      await expect(widget).toBeVisible()
    })

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

    test('accessor-backed canvasOnly follows renderer changes', async ({
      comfyPage
    }) => {
      const panel = new PropertiesPanelHelper(comfyPage.page)
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.page.evaluate(() => {
        const kSampler = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        if (!kSampler) throw new Error('KSampler node not found')
        window.app!.canvas.selectNode(kSampler)
      })
      await expect(panel.panelTitle).toContainText('KSampler')
      await panel.getTab('Parameters').click()

      const nodeWidget = comfyPage.vueNodes
        .getNodeByTitle('KSampler')
        .getByLabel('steps', { exact: true })
      const panelWidget = panel.contentArea.getByText('steps', { exact: true })

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.LiteGraph?.vueNodesMode)
        )
        .toBe(true)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')
        Object.defineProperty(widget.options, 'canvasOnly', {
          configurable: true,
          enumerable: true,
          get() {
            return !window.LiteGraph?.vueNodesMode
          }
        })
      })

      await expect(nodeWidget).toBeVisible()
      await expect(panelWidget).toBeVisible()

      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      await expect(panelWidget).toBeHidden()

      await comfyPage.menu.topbar.setVueNodesEnabled(true)
      await expect(nodeWidget).toBeVisible()
      await expect(panelWidget).toBeVisible()
    })
  }
)
