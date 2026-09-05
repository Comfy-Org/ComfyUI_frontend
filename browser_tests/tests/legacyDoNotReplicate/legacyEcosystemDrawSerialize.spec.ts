import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Legacy ecosystem widget draw and serialization mutations',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('a no-op custom draw hides only its widget and preserves its value', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')
      const cfg = comfyPage.vueNodes.getWidgetByName('KSampler', 'cfg')

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
        widget.draw = () => {}
        widget.computeSize = () => [0, -4]
      })
      await comfyPage.nextFrame()

      await expect(steps).toBeHidden()
      await expect(cfg).toBeVisible()
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

    test('a custom draw renders as a canvas fallback regardless of connection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()

      await comfyPage.page.evaluate(() => {
        const node = window.LiteGraph!.createNode('Note')!
        node.title = 'Connected custom draw'
        const widget = node.addWidget('number', 'steps', 20, () => {})
        node.addInput('steps', 'INT', { widget: { name: widget.name } })
        window.app!.graph.add(node)

        const legacy = Object.assign(widget, { drawCalls: 0 })
        widget.draw = function (ctx, _owner, width, y, height) {
          legacy.drawCalls++
          ctx.fillRect(0, y, width, height)
        }
        const source = window.LiteGraph!.createNode('Note')!
        source.addOutput('steps', 'INT')
        window.app!.graph.add(source)
        const link = source.connect(0, node, 0)
        if (!link) throw new Error('Failed to connect custom draw widget input')
        window.app!.graph.setDirtyCanvas(true, true)
      })
      await comfyPage.nextFrame()

      const node = comfyPage.vueNodes.getNodeByTitle('Connected custom draw')
      await expect(node).toBeVisible()
      const steps = comfyPage.vueNodes.getWidgetByName(
        'Connected custom draw',
        'steps'
      )
      await expect(steps).toHaveCount(0)
      await expect(node.locator('.lg-node-widget canvas')).toHaveCount(1)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.title === 'Connected custom draw'
            )
            const widget = node?.widgets?.find(
              (candidate) => candidate.name === 'steps'
            )
            return widget &&
              'drawCalls' in widget &&
              typeof widget.drawCalls === 'number'
              ? widget.drawCalls
              : 0
          })
        )
        .toBeGreaterThan(0)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.title === 'Connected custom draw'
        )
        if (!node) throw new Error('Connected custom draw node not found')

        node.disconnectInput(0)
      })
      await comfyPage.nextFrame()

      await expect(steps).toHaveCount(0)
      await expect(node.locator('.lg-node-widget canvas')).toHaveCount(1)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.title === 'Connected custom draw'
            )
            return node?.serialize().widgets_values_named?.steps
          })
        )
        .toBe(20)
    })

    test('serialize false removes a widget from both positional and named values', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

      const { before, after } = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!node || !widget) throw new Error('KSampler steps widget not found')

        widget.value = 37
        const before = node.serialize()
        widget.serialize = false
        const after = node.serialize()
        return { before, after }
      })

      expect(before.widgets_values_named?.steps).toBe(37)
      expect(after.widgets_values_named).toEqual(
        Object.fromEntries(
          Object.entries(before.widgets_values_named ?? {}).filter(
            ([name]) => name !== 'steps'
          )
        )
      )
      expect(before.widgets_values).toContain(37)
      expect(after.widgets_values).toEqual(
        before.widgets_values?.filter((value) => value !== 37)
      )
    })

    test('wholesale options replacement keeps a toggle functional and preserves hidden state', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/boolean_widget')
      const node = comfyPage.vueNodes.getNodeByTitle('Node With Boolean Input')
      const enabledButton = node.getByRole('button', { name: 'Enabled' })

      await comfyPage.page.evaluate(() => {
        const widget = window.app!.graph.nodes[0]?.widgets?.[0]
        if (!widget) throw new Error('Boolean widget not found')
        widget.options = { on: 'Enabled', off: 'Disabled' }
      })
      await comfyPage.nextFrame()

      await expect(enabledButton).toBeVisible()
      await enabledButton.click()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.graph.nodes[0]?.widgets?.[0]?.value
          )
        )
        .toBe(true)

      await comfyPage.page.evaluate(() => {
        const widget = window.app!.graph.nodes[0]?.widgets?.[0]
        if (!widget) throw new Error('Boolean widget not found')
        widget.options.hidden = true
        widget.options = { on: 'Enabled', off: 'Disabled' }
      })
      await comfyPage.nextFrame()

      await expect(node).toBeVisible()
      await expect(enabledButton).toHaveCount(0)
    })
  }
)
