import { assert, expect, it, onTestFinished } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  onGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import { getWidgetControlView } from '@/core/graph/widgets/control/widgetControl'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { wireWidgets } from './wireWidgets'

it('keeps row controls scoped and writes through to ECS without adding live widgets', () => {
  const node = new LGraphNode('Dynamic controls')
  node.serialize_widgets = true
  useLitegraphService().addNodeInput(node, {
    name: 'rows',
    type: 'COMFY_DYNAMICGROUP_V3',
    isOptional: false,
    min: 2,
    max: 3,
    template: {
      required: { seed: ['INT', { default: 1, control_after_generate: true }] }
    }
  })
  const graph = new LGraph()
  withGraphIntentSource('load', () => graph.add(node))
  const targets = node.widgets?.filter((widget) =>
    widget.name.endsWith('.seed')
  )
  assert.exists(targets)
  expect(targets).toHaveLength(2)
  const controls = wireWidgets(node).filter((widget) =>
    widget.name.endsWith('.seed.0')
  )
  expect(controls.map((widget) => widget.name)).toEqual([
    'rows.0.seed.0',
    'rows.1.seed.0'
  ])
  const control = controls[1]
  assert.exists(control)
  control.value = 'decrement'
  expect(controls[0].value).toBe('randomize')
  const targetId = targets[1].widgetId
  assert.exists(targetId)
  expect(useWidgetValueStore().getWidgetControl(targetId)?.mode).toBe(
    'decrement'
  )
  expect(node.serialize().widgets_values).toEqual([
    2,
    1,
    'randomize',
    1,
    'decrement'
  ])
  expect(node.widgets?.some((widget) => widget.name.endsWith('.seed.0'))).toBe(
    false
  )
  expect(wireWidgets(node).find((widget) => widget.name === control.name)).toBe(
    control
  )
  const intents: GraphIntentEvent[] = []
  onTestFinished(onGraphIntent((event) => intents.push(event)))
  getWidgetControlView(targets[1])?.update('increment')
  expect(control.value).toBe('increment')
  expect(intents).toEqual([
    {
      type: 'set_widget',
      source: 'local',
      graphId: graph.id,
      nodeId: node.id,
      name: 'rows.1.seed.0',
      value: 'increment',
      previous: 'decrement'
    }
  ])
})
