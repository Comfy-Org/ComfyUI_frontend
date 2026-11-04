import { assert, describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  getControlProjectionBatch,
  getControlProjections
} from './controlProjection'

describe('classic control projection', () => {
  it('normalizes ownerless siblings from their requested mode and filter names', () => {
    const first = {
      type: 'combo',
      name: 'first',
      value: 'a',
      options: {},
      y: 0,
      controlConfig: { mode: 'fixed', hasFilter: true }
    } satisfies IBaseWidget
    const second = { ...first, name: 'second' }
    const [mode, filter] = getControlProjections(first, [first, second])
    assert.exists(mode)
    assert.exists(filter)
    mode.name = 'custom mode'
    filter.name = 'custom filter'
    const widgets = [
      first,
      second,
      { ...first, name: 'custom mode', controlConfig: undefined },
      { ...first, name: 'custom filter', controlConfig: undefined }
    ]

    const batch = getControlProjectionBatch(widgets)

    expect(batch.get(first)?.map(({ name }) => name)).toEqual([
      'custom mode#1',
      'custom filter#1'
    ])
    expect(batch.get(second)?.map(({ name }) => name)).toEqual([
      'control_after_generate',
      'control_filter_list'
    ])
    expect(
      getControlProjections(first, [first, second]).map(({ name }) => name)
    ).toEqual(['custom mode', 'custom filter'])
  })

  it('retains externally defined getter names as the target changes', () => {
    const node = new LGraphNode('DynamicSeed')
    const target = node.addWidget('number', 'seeds.0.seed', 1, () => {})
    target.controlConfig = { mode: 'fixed', hasFilter: false }
    const [mode] = getControlProjections(target)
    assert.exists(mode)
    Object.defineProperty(mode, 'name', {
      get: () => `${target.name}.control_after_generate`
    })
    target.name = 'seeds.1.seed'

    expect(getControlProjections(target)[0]?.name).toBe(
      'seeds.1.seed.control_after_generate'
    )
  })

  it('renders and edits component state without entering node.widgets', () => {
    const graph = new LGraph()
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('number', 'seed', 1, () => {}, {})
    seed.controlConfig = { mode: 'increment', hasFilter: false }
    graph.add(node)

    const rendered = node.getLayoutWidgets()
    expect(node.widgets?.map(({ name }) => name)).toEqual(['seed'])
    expect(rendered.map(({ name }) => name)).toEqual([
      'seed',
      'control_after_generate'
    ])

    rendered[1].callback?.('randomize')
    expect(
      seed.widgetId
        ? useWidgetValueStore().getWidgetControl(seed.widgetId)?.mode
        : undefined
    ).toBe('randomize')
  })

  it('delegates target visibility to every projection', () => {
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('combo', 'seed', 'one', () => {}, {
      values: ['one', 'two']
    })
    seed.controlConfig = {
      mode: 'increment',
      hasFilter: true,
      filter: ''
    }
    seed.hidden = true
    seed.advanced = true
    seed.connectionSuppressed = true

    const projections = getControlProjections(seed)
    expect(projections).toHaveLength(2)
    expect(
      projections.map(
        ({ visibility, hidden, advanced, connectionSuppressed }) => ({
          visibility,
          hidden,
          advanced,
          connectionSuppressed
        })
      )
    ).toEqual([
      {
        visibility: seed.visibility,
        hidden: true,
        advanced: true,
        connectionSuppressed: true
      },
      {
        visibility: seed.visibility,
        hidden: true,
        advanced: true,
        connectionSuppressed: true
      }
    ])
  })

  it('renders control labels from the current mode without rewriting widgets', () => {
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('number', 'seed', 1, () => {})
    seed.controlConfig = { mode: 'fixed', hasFilter: false }
    const [controlWidget] = getControlProjections(seed)
    assert.exists(controlWidget)
    const settingStore = useSettingStore()

    settingStore.settingValues['Comfy.WidgetControlMode'] = 'before'
    const labelBeforeMode = controlWidget.label
    expect(labelBeforeMode).toBeTruthy()

    settingStore.settingValues['Comfy.WidgetControlMode'] = 'after'
    expect(controlWidget.label).toBeTruthy()
    expect(controlWidget.label).not.toBe(labelBeforeMode)
    expect(node.widgets?.map(({ name }) => name)).toEqual(['seed'])
  })

  it('converts projections for classic canvas drawing', () => {
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('number', 'seed', 1, () => {}, {})
    seed.controlConfig = { mode: 'increment', hasFilter: false }
    const [projection] = getControlProjections(seed)
    if (!projection) throw new Error('Expected a control projection')

    const concrete = toConcreteWidget(projection, node)

    expect(concrete.visibility).toBe(seed.visibility)
    seed.hidden = true
    expect(concrete.hidden).toBe(true)
  })
})
