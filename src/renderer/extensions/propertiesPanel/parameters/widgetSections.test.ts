import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { deriveWidgetVisibility } from '@/types/widgetVisibility'
import type { IBaseWidget, IWidgetOptions } from '@comfyorg/graph-model/widgets'

import { computedSectionDataList } from './widgetSections'

describe('computedSectionDataList', () => {
  function createWidget(
    name: string,
    options: IWidgetOptions = {}
  ): IBaseWidget {
    return { name, type: 'number', options, y: 0 }
  }

  it('omits hideInPanel widgets while keeping the rest on the node', () => {
    const node = new LGraphNode('Load3D')
    node.widgets = [
      createWidget('seed'),
      createWidget('viewport', { hideInPanel: true })
    ]

    const { widgetsSectionDataList } = computedSectionDataList([node])
    const shownNames = widgetsSectionDataList.value[0].widgets.map(
      ({ widget }) => widget.name
    )

    expect(shownNames).toEqual(['seed'])
  })

  it('hides canvasOnly, hidden, and hideInPanel widgets from the panel', () => {
    const node = new LGraphNode('Load3D')
    node.widgets = [
      createWidget('seed'),
      createWidget('preview', { canvasOnly: true }),
      createWidget('internal', { hidden: true }),
      createWidget('viewport', { hideInPanel: true })
    ]

    const { widgetsSectionDataList } = computedSectionDataList([node])
    const shownNames = widgetsSectionDataList.value[0].widgets.map(
      ({ widget }) => widget.name
    )

    expect(shownNames).toEqual(['seed'])
  })

  it('uses panel visibility tiers and suppression', () => {
    const node = new LGraphNode('Visibility')
    const connected = createWidget('connected')
    node.widgets = [
      createWidget('shown'),
      createWidget('hidden', { hidden: true }),
      createWidget('panel-hidden', { hideInPanel: true }),
      createWidget('canvas-only', { canvasOnly: true }),
      createWidget('advanced', { advanced: true }),
      connected
    ]
    const connectedVisibility = deriveWidgetVisibility(connected)
    connectedVisibility.suppression.byConnection = true
    const registeredConnected = node.widgets.at(-1)
    if (!registeredConnected) throw new Error('Missing connected widget')
    Object.defineProperty(registeredConnected, 'visibility', {
      value: connectedVisibility
    })

    const { widgetsSectionDataList } = computedSectionDataList([node])
    const shownNames = () =>
      widgetsSectionDataList.value[0].widgets.map(({ widget }) => widget.name)

    expect(shownNames()).toEqual(['shown'])
    useSettingStore().settingValues['Comfy.Node.AlwaysShowAdvancedWidgets'] =
      true
    expect(shownNames()).toEqual(['shown', 'advanced'])
  })
})
