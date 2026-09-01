import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Legacy ecosystem widget type toggles',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    test('restoring an efficiency-nodes type toggle leaves a legacy fallback', async ({
      comfyPage
    }) => {
      const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')
      const node = comfyPage.vueNodes.getNodeByTitle('KSampler')
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
        widget.type = 'tschide'
        widget.computeSize = () => [0, -4]
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

        widget.type = 'number'
        widget.computeSize = undefined
      })
      await comfyPage.nextFrame()

      await expect(widget).toHaveCount(0)
      await expect(node.locator('.lg-node-widget canvas')).toBeVisible()
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
    })

    test('keeps a pre-hidden widget hidden after restoring its type', async ({
      comfyPage
    }) => {
      const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        widget.hidden = true
        widget.type = 'tschide'
        widget.computeSize = () => [0, -4]
        widget.type = 'number'
        widget.computeSize = undefined
      })
      await comfyPage.nextFrame()

      await expect(widget).toBeHidden()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.type === 'KSampler'
            )
            const widget = node?.widgets?.find(
              (candidate) => candidate.name === 'steps'
            )
            return { hidden: widget?.hidden, type: widget?.type }
          })
        )
        .toEqual({ hidden: true, type: 'number' })
    })

    test('hides an mxToolkit-style hidden combo without dropping node data', async ({
      comfyPage
    }) => {
      const widget = comfyPage.vueNodes.getWidgetByName(
        'KSampler',
        'sampler_name'
      )

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'sampler_name'
        )
        if (!widget) throw new Error('KSampler sampler_name widget not found')

        widget.hidden = true
        widget.type = 'hidden'
      })
      await comfyPage.nextFrame()

      await expect(widget).toBeHidden()
      await expect(comfyPage.vueNodes.getNodeByTitle('KSampler')).toBeVisible()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.type === 'KSampler'
            )
            return node?.serialize().widgets_values_named?.sampler_name
          })
        )
        .toBe('euler')
    })

    test('renders an unknown sentinel as a visible legacy fallback', async ({
      comfyPage
    }) => {
      const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')
      const node = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect(widget).toBeVisible()

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        widget.value = 39
        widget.type = 'ggcustomtag'
        widget.computeSize = () => [0, -4]
      })
      await comfyPage.nextFrame()

      await expect(widget).toHaveCount(0)
      await expect(node.locator('.lg-node-widget canvas')).toBeVisible()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.type === 'KSampler'
            )
            return node?.serialize().widgets_values_named?.steps
          })
        )
        .toBe(39)
    })

    test('restores an m3rr-style converted widget after hiding it', async ({
      comfyPage
    }) => {
      const widget = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        widget.value = 40
        widget.hidden = true
        widget.type = 'converted-widget'
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
        .toBe(40)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        widget.type = 'number'
        widget.hidden = false
      })
      await comfyPage.nextFrame()

      await expect(widget).toBeVisible()
      await expect(widget.getByRole('spinbutton')).toHaveValue('40')
    })
  }
)
