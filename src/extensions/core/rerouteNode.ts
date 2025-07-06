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
      static override category: string | undefined
      static defaultVisibility = false

      constructor(title?: string) {
        // @ts-expect-error fixme ts strict error
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
            // @ts-expect-error fixme ts strict error
            this.onConnectionsChange(LiteGraph.INPUT, null, true, null)
          })
        }

        this.onConnectionsChange = (type, _index, connected) => {
          if (app.configuringGraph) return

          // Prevent multiple connections to different types when we have no input
          if (connected && type === LiteGraph.OUTPUT) {
            // Ignore wildcard nodes as these will be updated to real types
            const types = new Set(
              // @ts-expect-error fixme ts strict error
              this.outputs[0].links
                .map((l) => app.graph.links[l].type)
                .filter((t) => t !== '*')
            )
            if (types.size > 1) {
              const linksToDisconnect = []
              // @ts-expect-error fixme ts strict error
              for (let i = 0; i < this.outputs[0].links.length - 1; i++) {
                // @ts-expect-error fixme ts strict error
                const linkId = this.outputs[0].links[i]
                const link = app.graph.links[linkId]
                linksToDisconnect.push(link)
              }
              for (const link of linksToDisconnect) {
                const node = app.graph.getNodeById(link.target_id)
                // @ts-expect-error fixme ts strict error
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
              // @ts-expect-error fixme ts strict error
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
                // @ts-expect-error fixme ts strict error
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
            // @ts-expect-error fixme ts strict error
            currentNode = nodes.pop()
            const outputs =
              // @ts-expect-error fixme ts strict error
              (currentNode.outputs ? currentNode.outputs[0].links : []) || []
            if (outputs.length) {
              for (const linkId of outputs) {
                const link = app.graph.links[linkId]

                // When disconnecting sometimes the link is still registered
                if (!link) continue

                const node = app.graph.getNodeById(link.target_id)
                // @ts-expect-error fixme ts strict error
                const type = node.constructor.type

                if (type === 'Reroute') {
                  // Follow reroute nodes
                  // @ts-expect-error fixme ts strict error
                  nodes.push(node)
                  updateNodes.push(node)
                } else {
                  // We've found an output
                  const nodeOutType =
                    // @ts-expect-error fixme ts strict error
                    node.inputs &&
                    // @ts-expect-error fixme ts strict error
                    node.inputs[link?.target_slot] &&
                    // @ts-expect-error fixme ts strict error
                    node.inputs[link.target_slot].type
                      ? // @ts-expect-error fixme ts strict error
                        node.inputs[link.target_slot].type
                      : null
                  if (
                    inputType &&
                    // @ts-expect-error fixme ts strict error
                    !LiteGraph.isValidConnection(inputType, nodeOutType)
                  ) {
                    // The output doesnt match our input so disconnect it
                    // @ts-expect-error fixme ts strict error
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
          let widgetType
          // Update the types of each node
          for (const node of updateNodes) {
            // If we dont have an input type we are always wildcard but we'll show the output type
            // This lets you change the output link to a different type and all nodes will update
            // @ts-expect-error fixme ts strict error
            node.outputs[0].type = inputType || '*'
            // @ts-expect-error fixme ts strict error
            node.__outputType = displayType
            // @ts-expect-error fixme ts strict error
            node.outputs[0].name = node.properties.showOutputText
              ? displayType
              : ''
            // @ts-expect-error fixme ts strict error
            node.setSize(node.computeSize())

            // @ts-expect-error fixme ts strict error
            for (const l of node.outputs[0].links || []) {
              const link = app.graph.links[l]
              if (link) {
                link.color = color

                if (app.configuringGraph) continue
                const targetNode = app.graph.getNodeById(link.target_id)
                // @ts-expect-error fixme ts strict error
                const targetInput = targetNode.inputs?.[link.target_slot]
                if (targetInput?.widget) {
                  const config = getWidgetConfig(targetInput)
                  if (!widgetConfig) {
                    widgetConfig = config[1] ?? {}
                    widgetType = config[0]
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
              // @ts-expect-error fixme ts strict error
              node.inputs[0].widget = { name: 'value' }
              // @ts-expect-error fixme ts strict error
              setWidgetConfig(node.inputs[0], [
                // @ts-expect-error fixme ts strict error
                widgetType ?? displayType,
                widgetConfig
              ])
            } else {
              // @ts-expect-error fixme ts strict error
              setWidgetConfig(node.inputs[0], null)
            }
          }

          if (inputNode) {
            // @ts-expect-error fixme ts strict error
            const link = app.graph.links[inputNode.inputs[0].link]
            if (link) {
              link.color = color
            }
          }
        }

        this.clone = function () {
          const cloned = RerouteNode.prototype.clone.apply(this)
          // @ts-expect-error fixme ts strict error
          cloned.removeOutput(0)
          // @ts-expect-error fixme ts strict error
          cloned.addOutput(this.properties.showOutputText ? '*' : '', '*')
          // @ts-expect-error fixme ts strict error
          cloned.setSize(cloned.computeSize())
          return cloned
        }

        // This node is purely frontend and does not impact the resulting prompt so should not be serialized
        this.isVirtualNode = true
      }

      // @ts-expect-error fixme ts strict error
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
      override computeSize(): [number, number] {
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

      // @ts-expect-error fixme ts strict error
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
