import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import { app } from '@/scripts/app'
import { closureOnly } from '@/scripts/nodeMenu'

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
          callback: closureOnly(() => {
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
          })
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
                  callback: closureOnly(() => app.canvas.centerOnNode(target))
                }))
            }
          }))
        }
      })
      return options
    }
  },
  nodeCreated(node) {
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
