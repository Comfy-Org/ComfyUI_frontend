import {
  createBounds,
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LLink
} from '@comfyorg/litegraph'
import nodeColors from '../../data/workflow-node-colors.json'
import type { ViewerGraph, ViewerWorkflow } from '../../config/workflow-viewer'
import { nodeValues } from '../../config/workflow-viewer'

export function createWorkflowCanvas(
  element: HTMLCanvasElement,
  workflow: ViewerWorkflow
) {
  const graph = new LGraph()
  const canvas = new LGraphCanvas(element, graph)
  Object.assign(LGraphCanvas.link_type_colors, nodeColors)
  Object.assign(canvas.default_connection_color_byType, nodeColors)
  canvas.read_only = true
  canvas.allow_dragnodes = false
  canvas.allow_interaction = false
  canvas.allow_dragcanvas = true
  canvas.show_info = false
  canvas.low_quality_zoom_threshold = 0
  canvas.render_canvas_border = false
  canvas.background_image = ''
  canvas.clear_background_color = '#171819'
  canvas.ds.min_scale = 0.02
  const typeName = (type: string | number | string[]) =>
    Array.isArray(type) ? type.join(',') : type

  function show(source: ViewerGraph) {
    graph.clear()
    for (const data of source.groups) {
      const group = new LGraphGroup(data.title)
      group.pos = [data.bounding[0], data.bounding[1]]
      group.size = [data.bounding[2], data.bounding[3]]
      if (data.color) group.color = data.color
      graph.add(group)
    }
    for (const data of source.nodes) {
      const subgraph = workflow.definitions?.subgraphs.find(
        (item) => item.id === data.type
      )
      const node = new LGraphNode(data.title ?? subgraph?.name ?? data.type)
      node.id = data.id
      node.type = data.type
      node.pos = [...data.pos]
      node.color = data.color ?? (subgraph ? '#334b43' : '#303338')
      node.bgcolor = data.bgcolor ?? '#242629'
      for (const input of data.inputs)
        node.addInput(input.name, typeName(input.type))
      for (const output of data.outputs)
        node.addOutput(output.name, typeName(output.type))
      for (const value of nodeValues(data)) {
        node.addWidget(
          'text',
          '',
          value.replace(/\s+/g, ' ').slice(0, 180),
          () => undefined,
          { read_only: true }
        )
      }
      node.size = [...data.size]
      graph.add(node)
    }
    for (const [boundary, slots, input] of [
      [source.inputNode, source.inputs, true],
      [source.outputNode, source.outputs, false]
    ] as const) {
      if (!boundary) continue
      const node = new LGraphNode(
        input ? 'Workflow inputs' : 'Workflow outputs'
      )
      node.id = boundary.id
      node.pos = [boundary.bounding[0], boundary.bounding[1]]
      for (const slot of slots) {
        if (input) node.addOutput(slot.name, typeName(slot.type))
        else node.addInput(slot.name, typeName(slot.type))
      }
      graph.add(node)
    }
    for (const data of source.links) {
      const origin = graph.getNodeById(data.origin_id)
      const target = graph.getNodeById(data.target_id)
      const output = origin?.outputs[data.origin_slot]
      const input = target?.inputs[data.target_slot]
      if (!output || !input) continue
      const link = new LLink(
        data.id,
        output.type,
        data.origin_id,
        data.origin_slot,
        data.target_id,
        data.target_slot
      )
      graph.links.set(link.id, link)
      output.links = [...(output.links ?? []), link.id]
      input.link = link.id
    }
    fit()
  }
  function fit() {
    const scale = window.devicePixelRatio || 1
    canvas.resize(element.clientWidth * scale, element.clientHeight * scale)
    canvas.ctx.setTransform(scale, 0, 0, scale, 0, 0)
    for (const node of graph.nodes) node.updateArea(canvas.ctx)
    const bounds = createBounds(graph.nodes)
    if (bounds) canvas.ds.fitToBounds(bounds, { zoom: 0.88 })
    canvas.setDirty(true, true)
  }
  return {
    show,
    fit,
    zoom(factor: number) {
      const bounds = element.getBoundingClientRect()
      canvas.ds.changeScale(canvas.ds.scale * factor, [
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2
      ])
      canvas.setDirty(true, true)
    },
    pan(x: number, y: number) {
      canvas.ds.offset = [
        canvas.ds.offset[0] + x / canvas.ds.scale,
        canvas.ds.offset[1] + y / canvas.ds.scale
      ]
      canvas.setDirty(true, true)
    },
    dispose() {
      canvas.stopRendering()
      canvas.unbindEvents()
      graph.detachCanvas(canvas)
      graph.clear()
    }
  }
}
