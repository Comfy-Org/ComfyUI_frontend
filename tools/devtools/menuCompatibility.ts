import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import type { ContextMenu } from '@/lib/litegraph/src/ContextMenu'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

declare const LiteGraph: LiteGraphGlobal

const scenario = new URL(import.meta.url).searchParams.get('scenario')

app.registerExtension({
  name: 'DevTools.MenuCompatibility',
  beforeRegisterNodeDef(nodeType, nodeData) {
    const inputs = { ...nodeData.input?.required, ...nodeData.input?.optional }
    if (!('width' in inputs) || !('height' in inputs)) return
    const previous = nodeType.prototype.getExtraMenuOptions
    nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
      const result = previous?.call(this, canvas, options) ?? []
      options.push(
        {
          content: 'Swap width/height',
          callback: () => {
            const width = this.widgets?.find(
              (widget) => widget.name === 'width'
            )
            const height = this.widgets?.find(
              (widget) => widget.name === 'height'
            )
            if (!width || !height) return
            const value = width.value
            width.value = height.value
            height.value = value
            app.graph.setDirtyCanvas(true)
          }
        },
        null
      )
      return result
    }
  },
  setup() {
    const previous = app.canvas.getNodeMenuOptions
    app.canvas.getNodeMenuOptions = function (node) {
      const options = previous.call(this, node)
      const nodes = app.graph._nodes
      const types = [...new Set(nodes.map((target) => target.type))].sort()
      options.push({
        content: 'Go to node',
        has_submenu: true,
        submenu: {
          options: types.map((type) => ({
            content: type,
            has_submenu: true,
            submenu: {
              options: nodes
                .filter((target) => target.type === type)
                .toSorted((a, b) => a.pos[0] - b.pos[0])
                .map((target) => ({
                  content: `${target.getTitle()} - #${target.id} (${target.pos[0]}, ${target.pos[1]})`,
                  callback: () => app.canvas.centerOnNode(target)
                }))
            }
          }))
        }
      })
      return options
    }
  },
  nodeCreated(node) {
    if (scenario === 'ecosystem') {
      addQueueSelectedOutputNodes(node)
      if (node.comfyClass === 'KSampler') {
        addSetSampler(node)
        addUseEverywhereInputs(node)
      }
      return
    }
    if (scenario !== 'native' || node.comfyClass !== 'EmptyLatentImage') return
    const previous = node.getExtraMenuOptions
    node.getExtraMenuOptions = function (canvas, options) {
      const result = previous?.call(this, canvas, options) ?? []
      const index = options.findIndex((item) =>
        item?.content?.includes('Shape')
      )
      options.splice(index + 1, 0, null, {
        content: 'Connections Layout',
        has_submenu: true,
        callback: (_value, _options, event, parentMenu) => {
          new LiteGraph.ContextMenu(
            ['Left -> Right', 'Right -> Left'].map((content) => ({ content })),
            {
              event,
              parentMenu,
              callback: (value) => {
                if (!value || typeof value === 'string') return
                node.properties.connections_layout =
                  value.content?.split(' -> ')
                node.graph?.setDirtyCanvas(true, true)
              }
            }
          )
        }
      })
      return result
    }
  }
})

function addQueueSelectedOutputNodes(node: LGraphNode) {
  const previous = node.getExtraMenuOptions
  node.getExtraMenuOptions = function (canvas, options) {
    const result = previous?.call(this, canvas, options) ?? []
    const outputNodes = Object.values(app.canvas.selected_nodes).filter(
      (target) =>
        (target.constructor as { nodeData?: { output_node?: boolean } })
          .nodeData?.output_node
    )
    const item = {
      content: 'Queue Selected Output Nodes (rgthree) &nbsp;',
      className: 'rgthree-contextmenu-item',
      callback: () => {
        for (const target of outputNodes) target.properties.queued = true
      },
      disabled: !outputNodes.length
    }
    let index = options.findIndex((option) => option?.content === 'Outputs') + 1
    index ||= options.findIndex((option) => option?.content === 'Align') + 1
    index ||= 3
    options.splice(index, 0, item)
    return result
  }
}

function addSetSampler(node: LGraphNode) {
  const previous = node.getExtraMenuOptions
  node.getExtraMenuOptions = function (canvas, options) {
    previous?.call(this, canvas, options)
    const widget = node.widgets?.find(
      (target) => target.name === 'sampler_name'
    )
    const values = widget?.options.values
    if (!widget || !Array.isArray(values)) return []
    options.splice(
      0,
      0,
      {
        content: 'Set sampler',
        submenu: {
          options: values.slice(0, 3).map(String),
          callback(value: unknown) {
            widget.value = String(value)
          }
        }
      },
      null
    )
    return []
  }
}

function addUseEverywhereInputs(node: LGraphNode) {
  const previous = node.getExtraMenuOptions
  node.getExtraMenuOptions = function (canvas, options) {
    previous?.apply(this, [canvas, options])
    options.push(null, {
      content: 'UE Connectable Inputs',
      has_submenu: true,
      callback: useEverywhereInputsSubmenu
    })
    return []
  }
}

function useEverywhereInputsSubmenu(
  _value: unknown,
  _options: unknown,
  event: MouseEvent,
  parentMenu: ContextMenu | undefined,
  node: LGraphNode
) {
  const stored = node.properties.input_ue_unconnectable
  const unconnectable: Record<string, boolean> =
    typeof stored === 'object' ? { ...stored } : {}
  node.properties.input_ue_unconnectable = unconnectable
  const names = node.inputs
    .filter((input) => !input.widget)
    .map((input) => input.name)
  const markConnectable = (root: Element | null | undefined) =>
    names.forEach((name, index) => {
      const entry = root?.querySelector<HTMLElement>(`:nth-child(${index + 1})`)
      if (entry)
        entry.style.borderLeft = unconnectable[name] ? '' : '2px solid #484'
    })
  const submenu = new LiteGraph.ContextMenu(names, {
    event,
    parentMenu,
    callback(this: HTMLElement | undefined, name) {
      if (typeof name !== 'string') return
      unconnectable[name] = !unconnectable[name]
      markConnectable(this?.parentElement)
      return true
    }
  })
  markConnectable(submenu.root)
}
