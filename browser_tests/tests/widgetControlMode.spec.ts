import { expect } from '@playwright/test'

import type { IWidget } from '@/lib/litegraph/src/litegraph'
import type { SerializedNodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

type DirtyWindow = Window & { __canvasDirtied?: boolean }

const getControlLabels = (comfyPage: ComfyPage, nodeId?: SerializedNodeId) =>
  comfyPage.page.evaluate(
    (id) => {
      const node =
        id === undefined
          ? window.app!.graph!.nodes[0]
          : window.app!.graph!.getNodeById(id)
      return (node?.widgets ?? [])
        .filter((widget) => (widget.label ?? '').includes('control'))
        .map((widget) => widget.label!)
    },
    nodeId === undefined ? undefined : toNodeId(nodeId)
  )

test.describe('WidgetControlMode setting', { tag: '@widget' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'after')
  })

  test('Changing mode to "before" updates control widget labels', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    const ksampler = (await comfyPage.nodeOps.getNodeRefsByType('KSampler'))[0]

    await expect
      .poll(() => getControlLabels(comfyPage, ksampler.id))
      .toEqual(expect.arrayContaining([expect.stringContaining('after')]))

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() => getControlLabels(comfyPage, ksampler.id))
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
      .poll(() => getControlLabels(comfyPage, ksampler.id))
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
          const ksamplers = window.app!.graph!.nodes.filter(
            (n) => n.type === 'KSampler'
          )
          return (
            ksamplers.length === 2 &&
            ksamplers.every((n) => {
              const controlLabels = (n.widgets ?? [])
                .filter((w) => (w.label ?? '').includes('control'))
                .map((w) => w.label ?? '')
              return (
                controlLabels.length > 0 &&
                controlLabels.every((label) => label.includes('before'))
              )
            })
          )
        })
      )
      .toBe(true)
  })

  test('Mode change still updates KSampler with a widget-less node', async ({
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
      .poll(() => getControlLabels(comfyPage, ksampler.id))
      .toEqual(expect.arrayContaining([expect.stringContaining('before')]))
  })

  test('Canvas is marked dirty after mode change', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    await comfyPage.page.evaluate(() => {
      const w = window as DirtyWindow
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
        comfyPage.page.evaluate(() => (window as DirtyWindow).__canvasDirtied)
      )
      .toBe(true)
  })

  test('Mode change updates combo control widget labels', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/combo_control_widget')

    await expect
      .poll(() => getControlLabels(comfyPage))
      .toEqual(expect.arrayContaining([expect.stringContaining('after')]))

    await comfyPage.settings.setSetting('Comfy.WidgetControlMode', 'before')

    await expect
      .poll(() => getControlLabels(comfyPage))
      .toEqual(expect.arrayContaining([expect.stringContaining('before')]))
  })

  test('Mode change propagates to linkedWidgets on control widgets', async ({
    comfyPage
  }) => {
    // linkedWidgets is only set on main widgets, never on control widgets
    // themselves. This covers the `linkedWidgets` defensive branch in
    // `updateControlWidgetLabels`.
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

    await comfyPage.page.evaluate(() => {
      const node = window.app!.graph!.nodes[0]
      if (!node?.widgets) return
      const controlWidget = node.widgets.find((w) =>
        (w.label ?? '').includes('control')
      )
      if (!controlWidget) return
      controlWidget.linkedWidgets = [
        {
          name: 'mock_filter',
          label: 'control after generate',
          type: 'string',
          value: ''
        } as IWidget
      ]
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
