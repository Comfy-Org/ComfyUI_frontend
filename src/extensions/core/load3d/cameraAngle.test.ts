import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import { graphToPrompt } from '@/utils/executionUtil'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'

import { cameraAngleExtension as extension } from './cameraAngle'
import { load3dWidgets } from './load3dWidgets'

class CameraAngleNode extends LGraphNode {
  static comfyClass = 'CameraAngle'
}

class OtherNode extends LGraphNode {
  static comfyClass = 'SomethingElse'
}

async function addCameraAngleNode(graph: LGraph) {
  const node = new CameraAngleNode('CameraAngle')
  node.comfyClass = 'CameraAngle'
  node.serialize_widgets = true
  node.addWidget('number', 'horizontal', 45, () => undefined, {})
  graph.add(node)

  load3dWidgets.CAMERA_ANGLE_VIEW(
    node,
    'view',
    ['CAMERA_ANGLE_VIEW', {}],
    fromPartial({})
  )

  const view = node.widgets?.find((widget) => widget.name === 'view')
  if (!view) throw new Error('view widget was not added to the node')
  return { node, view }
}

describe('Comfy.CameraAngle extension', () => {
  it('saves the view mode in the workflow but leaves it out of the prompt', async () => {
    const graph = new LGraph()
    const { node, view } = await addCameraAngleNode(graph)

    view.value = 'object'

    expect(node.serialize().widgets_values_named).toEqual({
      horizontal: 45,
      view: 'object'
    })
    const { output } = await graphToPrompt(graph)
    expect(output[String(node.id)].inputs).toEqual({ horizontal: 45 })
  })

  it('ignores values that are not a view mode', async () => {
    const { view } = await addCameraAngleNode(new LGraph())

    expect(view.value).toBe('camera')
    view.value = 'object'
    view.value = 'not-a-mode'
    expect(view.value).toBe('object')
  })

  it('keeps the viewport out of the right side panel', async () => {
    const { view } = await addCameraAngleNode(new LGraph())

    const visibility = view.visibility ?? deriveWidgetVisibility(view)

    expect(
      isWidgetVisibleOnSurface(visibility, 'panel', { showAdvanced: true })
    ).toBe(false)
  })

  it('enlarges CameraAngle nodes only', () => {
    const node = new CameraAngleNode('CameraAngle')
    const other = new OtherNode('SomethingElse')
    node.size = [100, 100]
    other.size = [100, 100]

    extension.nodeCreated?.(node, fromPartial<ComfyApp>({}))
    extension.nodeCreated?.(other, fromPartial<ComfyApp>({}))

    expect(Array.from(node.size)).toEqual([360, 480])
    expect(Array.from(other.size)).toEqual([100, 100])
  })
})
