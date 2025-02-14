// @ts-strict-ignore
import type { IContextMenuValue } from '@comfyorg/litegraph'
import { LGraphCanvas, LGraphNode, LiteGraph } from '@comfyorg/litegraph'

import { app } from '../../scripts/app'
import { getWidgetConfig, mergeIfValid, setWidgetConfig } from './widgetInputs'

// Node that allows you to redirect connections for cleaner graphs

app.registerExtension({
  name: 'Comfy.RerouteNode',
  registerCustomNodes(app) {
    interface RerouteNode extends LGraphNode {
      __outputType?: string
    }

    class RerouteNode extends LGraphNode {
      static category: string | undefined
      static defaultVisibility = false

      constructor(title?: string) {
        super(title)
        if (!this.properties) {
          this.properties = {}
        }
        this.properties.showOutputText = RerouteNode.defaultVisibility
        this.properties.horizontal = false

        this.addInput('', '*')
        this.addOutput(this.properties.showOutputText ? '*' : '', '*')

        this.onAfterGraphConfigured = function () {
          requestAnimationFrame(() => {
            this.onConnectionsChange(LiteGraph.INPUT, null, true, null)
          })
        }

        this.onConnectionsChange = (type, index, connected, link_info) => {
          if (app.configuringGraph) return

          // Prevent multiple connections to different types when we have no input
          if (connected && type === LiteGraph.OUTPUT) {
            // Ignore wildcard nodes as these will be updated to real types
            const types = new Set(
              this.outputs[0].links
                .map((l) => app.graph.links[l].type)
                .filter((t) => t !== '*')
            )
            if (types.size > 1) {
              const linksToDisconnect = []
              for (let i = 0; i < this.outputs[0].links.length - 1; i++) {
                const linkId = this.outputs[0].links[i]
                const link = app.graph.links[linkId]
                linksToDisconnect.push(link)
              }
              for (const link of linksToDisconnect) {
                const node = app.graph.getNodeById(link.target_id)
                node.disconnectInput(link.target_slot)
              }
            }
          }

          // Find root input
          let currentNode: LGraphNode | null = this
          let updateNodes = []
          let inputType = null
          let inputNode = null
          while (currentNode) {
            updateNodes.unshift(currentNode)
            const linkId = currentNode.inputs[0].link
            if (linkId !== null) {
              const link = app.graph.links[linkId]
              if (!link) return
              const node = app.graph.getNodeById(link.origin_id)
              const type = node.constructor.type
              if (type === 'Reroute') {
                if (node === this) {
                  // We've found a circle
                  currentNode.disconnectInput(link.target_slot)
                  currentNode = null
                } else {
                  // Move the previous node
                  currentNode = node
                }
              } else {
                // We've found the end
                inputNode = currentNode
                inputType = node.outputs[link.origin_slot]?.type ?? null
                break
              }
            } else {
              // This path has no input node
              currentNode = null
              break
            }
          }

          // Find all outputs
          const nodes: LGraphNode[] = [this]
          let outputType = null
          while (nodes.length) {
            currentNode = nodes.pop()
            const outputs =
              (currentNode.outputs ? currentNode.outputs[0].links : []) || []
            if (outputs.length) {
              for (const linkId of outputs) {
                const link = app.graph.links[linkId]

                // When disconnecting sometimes the link is still registered
                if (!link) continue

                const node = app.graph.getNodeById(link.target_id)
                const type = node.constructor.type

                if (type === 'Reroute') {
                  // Follow reroute nodes
                  nodes.push(node)
                  updateNodes.push(node)
                } else {
                  // We've found an output
                  const nodeOutType =
                    node.inputs &&
                    node.inputs[link?.target_slot] &&
                    node.inputs[link.target_slot].type
                      ? node.inputs[link.target_slot].type
                      : null
                  if (
                    inputType &&
                    !LiteGraph.isValidConnection(inputType, nodeOutType)
                  ) {
                    // The output doesnt match our input so disconnect it
                    node.disconnectInput(link.target_slot)
                  } else {
                    outputType = nodeOutType
                  }
                }
              }
            } else {
              // No more outputs for this path
            }
          }

          const displayType = inputType || outputType || '*'
          const color = LGraphCanvas.link_type_colors[displayType]

          let widgetConfig
          let targetWidget
          let widgetType
          // Update the types of each node
          for (const node of updateNodes) {
            // If we dont have an input type we are always wildcard but we'll show the output type
            // This lets you change the output link to a different type and all nodes will update
            node.outputs[0].type = inputType || '*'
            node.__outputType = displayType
            node.outputs[0].name = node.properties.showOutputText
              ? displayType
              : ''
            node.setSize(node.computeSize())

            for (const l of node.outputs[0].links || []) {
              const link = app.graph.links[l]
              if (link) {
                link.color = color

                if (app.configuringGraph) continue
                const targetNode = app.graph.getNodeById(link.target_id)
                const targetInput = targetNode.inputs?.[link.target_slot]
                if (targetInput?.widget) {
                  const config = getWidgetConfig(targetInput)
                  if (!widgetConfig) {
                    widgetConfig = config[1] ?? {}
                    widgetType = config[0]
                  }
                  if (!targetWidget) {
                    targetWidget = targetNode.widgets?.find(
                      (w) => w.name === (targetInput.widget as any).name
                    )
                  }

                  const merged = mergeIfValid(targetInput, [
                    config[0],
                    widgetConfig
                  ])
                  if (merged.customConfig) {
                    widgetConfig = merged.customConfig
                  }
                }
              }
            }
          }

          for (const node of updateNodes) {
            if (widgetConfig && outputType) {
              node.inputs[0].widget = { name: 'value' }
              setWidgetConfig(
                node.inputs[0],
                [widgetType ?? displayType, widgetConfig],
                targetWidget
              )
            } else {
              setWidgetConfig(node.inputs[0], null)
            }
          }

          if (inputNode) {
            const link = app.graph.links[inputNode.inputs[0].link]
            if (link) {
              link.color = color
            }
          }
        }

        this.clone = function () {
          const cloned = RerouteNode.prototype.clone.apply(this)
          cloned.removeOutput(0)
          cloned.addOutput(this.properties.showOutputText ? '*' : '', '*')
          cloned.setSize(cloned.computeSize())
          return cloned
        }

        // This node is purely frontend and does not impact the resulting prompt so should not be serialized
        this.isVirtualNode = true
      }

      getExtraMenuOptions(_, options): IContextMenuValue[] {
        options.unshift(
          {
            content:
              (this.properties.showOutputText ? 'Hide' : 'Show') + ' Type',
            callback: () => {
              this.properties.showOutputText = !this.properties.showOutputText
              if (this.properties.showOutputText) {
                this.outputs[0].name =
                  this.__outputType || (this.outputs[0].type as string)
              } else {
                this.outputs[0].name = ''
              }
              this.setSize(this.computeSize())
              app.graph.setDirtyCanvas(true, true)
            }
          },
          {
            content:
              (RerouteNode.defaultVisibility ? 'Hide' : 'Show') +
              ' Type By Default',
            callback: () => {
              RerouteNode.setDefaultTextVisibility(
                !RerouteNode.defaultVisibility
              )
            }
          }
        )
        return []
      }
      computeSize(): [number, number] {
        return [
          this.properties.showOutputText && this.outputs && this.outputs.length
            ? Math.max(
                75,
                LiteGraph.NODE_TEXT_SIZE * this.outputs[0].name.length * 0.6 +
                  40
              )
            : 75,
          26
        ]
      }

      static setDefaultTextVisibility(visible) {
        RerouteNode.defaultVisibility = visible
        if (visible) {
          localStorage['Comfy.RerouteNode.DefaultVisibility'] = 'true'
        } else {
          delete localStorage['Comfy.RerouteNode.DefaultVisibility']
        }
      }
    }

    // Load default visibility
    RerouteNode.setDefaultTextVisibility(
      !!localStorage['Comfy.RerouteNode.DefaultVisibility']
    )

    LiteGraph.registerNodeType(
      'Reroute',
      Object.assign(RerouteNode, {
        title_mode: LiteGraph.NO_TITLE,
        title: 'Reroute',
        collapsable: false
      })
    )

    RerouteNode.category = 'utils'
  }
})
