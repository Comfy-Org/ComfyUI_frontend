import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Legacy ecosystem widget visibility patterns',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    test('restores visibility from a captured origHidden value', async ({
      comfyPage
    }) => {
      const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        const legacyWidget = Object.assign(widget, {
          origHidden: widget.hidden ?? false
        })
        legacyWidget.hidden = true
      })
      await comfyPage.nextFrame()
      await expect(steps).toBeHidden()

      const hidden = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        const origHidden = Reflect.get(widget, 'origHidden')
        if (typeof origHidden !== 'boolean') {
          throw new Error('KSampler steps origHidden value not found')
        }
        widget.hidden = origHidden
        return widget.hidden
      })
      await comfyPage.nextFrame()

      expect(hidden).toBe(false)
      await expect(steps).toBeVisible()
    })

    test('keeps widget.hidden undefined while its associated input is connected', async ({
      comfyPage
    }) => {
      const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      const connectedHidden = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!node || !widget) throw new Error('KSampler steps widget not found')
        if (node.isSubgraphNode())
          throw new Error('KSampler is a subgraph node')

        const producer = window.LiteGraph!.createNode('Note')!
        producer.addOutput('INT', 'INT')
        window.app!.graph.add(producer)

        const input = node.addInput('steps', 'INT', {
          widget: { name: widget.name }
        })
        const inputIndex = node.inputs.indexOf(input)
        const capturedValue = widget.hidden ?? false
        const link = producer.connect(0, node, inputIndex)
        if (!link) throw new Error('Failed to connect steps widget input')

        return {
          capturedValue,
          hiddenIsUndefined: widget.hidden === undefined
        }
      })
      await comfyPage.nextFrame()

      expect(connectedHidden).toEqual({
        capturedValue: false,
        hiddenIsUndefined: true
      })
      await expect(steps).toBeVisible()

      const restoredHidden = await comfyPage.page.evaluate((capturedValue) => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!node || !widget) throw new Error('KSampler steps widget not found')

        node.disconnectInput('steps')
        widget.hidden = capturedValue
        return widget.hidden
      }, connectedHidden.capturedValue)
      await comfyPage.nextFrame()

      expect(restoredHidden).toBe(false)
      await expect(steps).toBeVisible()
    })

    test('toggles multiple widgets without dropping their serialized values', async ({
      comfyPage
    }) => {
      const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')
      const cfg = comfyPage.vueNodes.getWidgetByName('KSampler', 'cfg')

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        if (!node) throw new Error('KSampler node not found')

        for (const name of ['steps', 'cfg']) {
          const widget = node.widgets?.find(
            (candidate) => candidate.name === name
          )
          if (!widget) throw new Error(`KSampler ${name} widget not found`)
          const show = false
          widget.hidden = !show
        }
      })
      await comfyPage.nextFrame()

      await expect(steps).toBeHidden()
      await expect(cfg).toBeHidden()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.type === 'KSampler'
            )
            const values = node?.serialize().widgets_values_named
            return { steps: values?.steps, cfg: values?.cfg }
          })
        )
        .toEqual({ steps: 20, cfg: 8 })

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        if (!node) throw new Error('KSampler node not found')

        for (const name of ['steps', 'cfg']) {
          const widget = node.widgets?.find(
            (candidate) => candidate.name === name
          )
          if (!widget) throw new Error(`KSampler ${name} widget not found`)
          const show = true
          widget.hidden = !show
        }
      })
      await comfyPage.nextFrame()

      await expect(steps).toBeVisible()
      await expect(cfg).toBeVisible()
    })

    test('reacts to options.hidden being set and cleared', async ({
      comfyPage
    }) => {
      const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

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
      await comfyPage.nextFrame()
      await expect(steps).toBeHidden()

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')
        if (widget.options) widget.options.hidden = false
      })
      await comfyPage.nextFrame()

      await expect(steps).toBeVisible()
    })
  }
)
