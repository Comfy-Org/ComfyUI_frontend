import type { IContextMenuValue, LGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISlotType } from '@comfyorg/graph-model/interfaces'
import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { slotTypeKey } from '@/lib/litegraph/src/utils/type'
import { safeLocalStorage } from '@/base/storage/safeStorage'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useApp } from '@/scripts/appInstance'
import { getWidgetConfig, mergeIfValid, setWidgetConfig } from './widgetInputs'
import type { ComfyExtension } from '@/types/comfy'

// Node that allows you to redirect connections for cleaner graphs

function prefersLinkReroutes(): boolean {
  return useSettingStore().get('LiteGraph.Reroute.PreferLinkReroutes')
}

export const rerouteNodeExtension: ComfyExtension = {
  name: 'Comfy.RerouteNode',
  registerCustomNodes() {
    interface RerouteNode extends LGraphNode {
      __outputType?: string | number
    }

    class RerouteNode extends LGraphNode {
      static override category: string | undefined
      static defaultVisibility = false

      constructor(title?: string) {
        super(title ?? '')
        this.properties.showOutputText = RerouteNode.defaultVisibility
        this.properties.horizontal = false

        this.addInput('', '*')
        this.addOutput(this.properties.showOutputText ? '*' : '', '*')

        this.setSize(this.computeSize())

        this.isVirtualNode = true
      }
      override onAfterGraphConfigured() {
        requestAnimationFrame(() => {
          this.onConnectionsChange(LiteGraph.INPUT, undefined, true)
        })
      }
      override clone(): LGraphNode | null {
        const cloned = super.clone()
        if (!cloned) return cloned
        cloned.removeOutput(0)
        cloned.addOutput(this.properties.showOutputText ? '*' : '', '*')
        cloned.setSize(cloned.computeSize())
        return cloned
      }
      override onConnectionsChange(
        type: ISlotType,
        _index: number | undefined,
        connected: boolean
      ) {
        const { graph } = this
        if (!graph) return
        if (useApp().configuringGraph) return

        if (connected && type === LiteGraph.OUTPUT) {
          const links = outputLinks(graph, this.id, 0)
          const types = new Set(
            links.map((l) => l.type).filter((t) => t && t !== '*')
          )
          if (types.size > 1) {
            const linksToDisconnect = links.slice(0, -1)
            for (const link of linksToDisconnect) {
              const node = graph.getNodeById(link.target_id)
              node?.disconnectInput(link.target_slot)
            }
          }
        }

        const rootInput = findRootInput(this, graph)
        if (!rootInput) return
        const { updateNodes, inputNode, inputType } = rootInput

        const nodes: RerouteNode[] = [this]
        let outputType = null
        while (nodes.length) {
          const currentNode = nodes.pop()!
          for (const link of outputLinks(graph, currentNode.id, 0)) {
            const node = graph.getNodeById(link.target_id)
            if (!node) continue
            if (node instanceof RerouteNode) {
              nodes.push(node)
              updateNodes.push(node)
            } else {
              const nodeInput = node.inputs[link.target_slot]
              const nodeOutType = nodeInput.type
              const keep =
                !inputType ||
                !nodeOutType ||
                LiteGraph.isValidConnection(inputType, nodeOutType)
              if (!keep) {
                node.disconnectInput(link.target_slot)
                continue
              }
              node.onConnectionsChange?.(
                LiteGraph.INPUT,
                link.target_slot,
                keep,
                link,
                nodeInput
              )
              outputType = node.inputs[link.target_slot].type
            }
          }
        }

        const displayType = slotTypeKey(inputType || outputType || '*')
        const color = LGraphCanvas.link_type_colors[displayType]

        let widgetConfig
        let widgetType
        for (const node of updateNodes) {
          node.outputs[0].type = inputType || '*'
          node.__outputType = displayType
          node.outputs[0].name = node.properties.showOutputText
            ? `${displayType}`
            : ''
          node.setSize(node.computeSize())

          for (const link of outputLinks(graph, node.id, 0)) {
            link.color = color

            const targetNode = graph.getNodeById(link.target_id)
            if (!targetNode) continue
            const targetInput = targetNode.inputs.at(link.target_slot)
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

        for (const node of updateNodes) {
          if (widgetConfig && outputType) {
            node.inputs[0].widget = { name: 'value' }
            setWidgetConfig(node.inputs[0], [
              widgetType ?? `${displayType}`,
              widgetConfig
            ])
          } else {
            setWidgetConfig(node.inputs[0], undefined)
          }
        }

        const inputNodeLink = inputNode?.getInputLink(0)
        if (inputNodeLink) {
          inputNodeLink.color = color
        }
      }

      override getExtraMenuOptions(
        _: unknown,
        options: (IContextMenuValue | null)[]
      ): IContextMenuValue[] {
        options.unshift(
          {
            content:
              (this.properties.showOutputText ? 'Hide' : 'Show') + ' Type',
            callback: () => {
              this.properties.showOutputText = !this.properties.showOutputText
              if (this.properties.showOutputText) {
                this.outputs[0].name = `${this.__outputType || this.outputs[0].type}`
              } else {
                this.outputs[0].name = ''
              }
              this.setSize(this.computeSize())
              useApp().canvas.setDirty(true, true)
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
          this.properties.showOutputText && this.outputs.length
            ? Math.max(
                75,
                LiteGraph.NODE_TEXT_SIZE * this.outputs[0].name.length * 0.6 +
                  40
              )
            : 75,
          26
        ]
      }

      static setDefaultTextVisibility(visible: boolean) {
        RerouteNode.defaultVisibility = visible
        if (visible) {
          safeLocalStorage.setItem(
            'Comfy.RerouteNode.DefaultVisibility',
            'true'
          )
        } else {
          safeLocalStorage.removeItem('Comfy.RerouteNode.DefaultVisibility')
        }
      }
    }

    RerouteNode.setDefaultTextVisibility(
      !!safeLocalStorage.getItem('Comfy.RerouteNode.DefaultVisibility')
    )

    function findRootInput(start: RerouteNode, graph: LGraph) {
      const updateNodes: RerouteNode[] = [start]
      let currentNode = start
      let inputType: ISlotType | null = null
      let inputNode: RerouteNode | null = null
      while (currentNode.isInputConnected(0)) {
        const link = currentNode.getInputLink(0)
        if (!link) return null
        const node = graph.getNodeById(link.origin_id)
        if (!node) return null
        if (!(node instanceof RerouteNode)) {
          inputNode = currentNode
          inputType = node.outputs[link.origin_slot]?.type ?? null
          break
        }
        if (node === start) {
          currentNode.disconnectInput(link.target_slot)
          break
        }
        updateNodes.unshift(node)
        currentNode = node
      }
      return { updateNodes, inputNode, inputType }
    }

    LiteGraph.registerNodeType(
      'Reroute',
      Object.assign(RerouteNode, {
        title_mode: LiteGraph.NO_TITLE,
        title: 'Reroute',
        collapsable: false
      })
    )

    RerouteNode.category = 'utilities'
    Object.defineProperty(RerouteNode, 'skip_list', {
      get: prefersLinkReroutes,
      configurable: true
    })
  }
}
