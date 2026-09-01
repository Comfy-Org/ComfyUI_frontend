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

    test('assigning a custom draw removes its Vue control while connected', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()

      await comfyPage.page.evaluate(() => {
        const node = window.LiteGraph!.createNode('Note')!
        node.title = 'Connected custom draw'
        const widget = node.addWidget('number', 'steps', 20, () => {})
        node.addInput('steps', 'INT', { widget: { name: widget.name } })
        window.app!.graph.add(node)

        widget.draw = function (ctx, _owner, width, y, height) {
          ctx.fillRect(0, y, width, height)
        }
        const source = window.LiteGraph!.createNode('Note')!
        source.addOutput('steps', 'INT')
        window.app!.graph.add(source)
        source.connect(0, node, 0)
        window.app!.graph.setDirtyCanvas(true, true)
      })
      await comfyPage.nextFrame()

      await expect(
        comfyPage.vueNodes.getNodeByTitle('Connected custom draw')
      ).toBeVisible()
      const steps = comfyPage.vueNodes.getWidgetByName(
        'Connected custom draw',
        'steps'
      )
      await expect(steps).toHaveCount(0)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.title === 'Connected custom draw'
        )
        if (!node) throw new Error('Connected custom draw node not found')

        node.disconnectInput(0)
      })
      await comfyPage.nextFrame()

      await expect(steps).toBeVisible()
      await expect(steps.getByRole('spinbutton')).toHaveValue('20')
    })

    test('serialize false removes a widget from both positional and named values', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (candidate) => candidate.type === 'KSampler'
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'steps'
        )
        if (!widget) throw new Error('KSampler steps widget not found')

        widget.serialize = false
      })

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (candidate) => candidate.type === 'KSampler'
            )
            const serialized = node?.serialize()
            return {
              positional: serialized?.widgets_values,
              named: serialized?.widgets_values_named
            }
          })
        )
        .toEqual({
          positional: [156680208700286, 'randomize', 8, 'euler', 'normal', 1],
          named: {
            cfg: 8,
            control_after_generate: 'randomize',
            denoise: 1,
            sampler_name: 'euler',
            scheduler: 'normal',
            seed: 156680208700286
          }
        })
    })

    test('wholesale options replacement keeps a toggle functional and preserves hidden state', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/boolean_widget')
      const toggle = comfyPage.vueNodes.getWidgetByName(
        'Node With Boolean Input',
        'boolean_input'
      )

      await comfyPage.page.evaluate(() => {
        const widget = window.app!.graph.nodes[0]?.widgets?.[0]
        if (!widget) throw new Error('Boolean widget not found')
        widget.options = { on: 'Enabled', off: 'Disabled' }
      })
      await comfyPage.nextFrame()

      await expect(toggle).toBeVisible()
      await toggle.click()
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

      await expect(toggle).toBeHidden()
    })
  }
)
