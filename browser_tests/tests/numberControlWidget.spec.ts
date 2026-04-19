import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Number widget', { tag: ['@screenshot', '@widget'] }, () => {
  test('Can drag adjust value', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/seed_widget')

    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const widget = await node.getWidget(0)
    await comfyPage.page.evaluate(() => {
      window.widgetValue = undefined
      const widget = window.app!.graph!.nodes[0].widgets![0]
      widget.callback = (value: number) => {
        window.widgetValue = value
      }
    })
    await widget.dragHorizontal(50)
    await expect(comfyPage.canvas).toHaveScreenshot('seed_widget_dragged.png')

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.widgetValue))
      .toBeDefined()
  })
})

test.describe('WidgetControlMode setting', { tag: '@widget' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'after')
  })

  test('Changing mode to "before" updates control widget labels', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'after')
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const ksampler = (await comfyPage.nodeOps.getNodeRefsByType('KSampler'))[0]

    await expect
      .poll(() =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph!.getNodeById(id)
          return node?.widgets
            ?.filter((w) => (w.label ?? '').includes('control'))
            .map((w) => w.label)
        }, ksampler.id)
      )
      .toEqual(expect.arrayContaining([expect.stringContaining('after')]))

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph!.getNodeById(id)
          return node?.widgets
            ?.filter((w) => (w.label ?? '').includes('control'))
            .map((w) => w.label)
        }, ksampler.id)
      )
      .toEqual(expect.arrayContaining([expect.stringContaining('before')]))
  })

  test('Changing mode back to "after" restores labels', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const ksampler = (await comfyPage.nodeOps.getNodeRefsByType('KSampler'))[0]

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'after')

    await expect
      .poll(() =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph!.getNodeById(id)
          return node?.widgets
            ?.filter((w) => (w.label ?? '').includes('control'))
            .map((w) => w.label)
        }, ksampler.id)
      )
      .toEqual(expect.arrayContaining([expect.stringContaining('after')]))
  })

  test('Mode change updates control widgets across multiple nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('KSampler')
      node!.pos = [400, 30]
      window.app!.graph!.add(node!)
    })
    await comfyPage.nextFrame()

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          return window
            .app!.graph!.nodes.filter((n) => n.type === 'KSampler')
            .every((n) =>
              (n.widgets ?? [])
                .filter((w) => (w.label ?? '').includes('control'))
                .every((w) => w.label!.includes('before'))
            )
        })
      )
      .toBe(true)
  })

  test('Nodes without widgets are skipped without error', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('Reroute')
      if (node) {
        node.pos = [400, 30]
        window.app!.graph!.add(node)
      }
    })
    await comfyPage.nextFrame()

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    const ksampler = (await comfyPage.nodeOps.getNodeRefsByType('KSampler'))[0]
    await expect
      .poll(() =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph!.getNodeById(id)
          return node?.widgets
            ?.filter((w) => (w.label ?? '').includes('control'))
            .map((w) => w.label)
        }, ksampler.id)
      )
      .toEqual(expect.arrayContaining([expect.stringContaining('before')]))
  })

  test('Canvas is marked dirty after mode change', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    await comfyPage.page.evaluate(() => {
      const w = window as Window & { __canvasDirtied?: boolean }
      w.__canvasDirtied = false
      const origSetDirty = window.app!.canvas.setDirty.bind(window.app!.canvas)
      window.app!.canvas.setDirty = (
        ...args: Parameters<typeof origSetDirty>
      ) => {
        w.__canvasDirtied = true
        return origSetDirty(...args)
      }
    })

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          () =>
            (window as Window & { __canvasDirtied?: boolean }).__canvasDirtied
        )
      )
      .toBe(true)
  })

  test('Mode change updates combo control widget labels', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'after')
    await comfyPage.workflow.loadWorkflow('widgets/combo_control_widget')

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const node = window.app!.graph!.nodes[0]
          return (node?.widgets ?? [])
            .filter((w) => (w.label ?? '').includes('control'))
            .map((w) => w.label!)
        })
      )
      .toEqual(expect.arrayContaining([expect.stringContaining('after')]))

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const node = window.app!.graph!.nodes[0]
          return (node?.widgets ?? [])
            .filter((w) => (w.label ?? '').includes('control'))
            .map((w) => w.label!)
        })
      )
      .toEqual(expect.arrayContaining([expect.stringContaining('before')]))
  })

  test('Mode change propagates to linkedWidgets on control widgets', async ({
    comfyPage
  }) => {
    // linkedWidgets is only set on main widgets, never on control widgets
    // themselves. This covers the defensive code path (GraphCanvas.vue:360-362).
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    await comfyPage.page.evaluate(() => {
      const node = window.app!.graph!.nodes[0]
      if (!node?.widgets) return
      const controlWidget = node.widgets.find((w) =>
        (w.label ?? '').includes('control')
      )
      if (!controlWidget) return
      const mockLinked = Object.create(null)
      mockLinked.name = 'mock_filter'
      mockLinked.label = 'control after generate'
      mockLinked.type = 'string'
      mockLinked.value = ''
      controlWidget.linkedWidgets = [mockLinked]
    })

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const node = window.app!.graph!.nodes[0]
          const controlWidget = node?.widgets?.find((w) =>
            (w.label ?? '').includes('control')
          )
          const linked = controlWidget?.linkedWidgets ?? []
          return [controlWidget?.label, ...linked.map((l) => l.label ?? '')]
        })
      )
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining('before'),
          expect.stringContaining('before')
        ])
      )
  })
})
