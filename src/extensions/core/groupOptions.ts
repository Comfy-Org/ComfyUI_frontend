import { LGraphGroup } from '@comfyorg/litegraph'
import { LGraphCanvas } from '@comfyorg/litegraph'
import type { LGraphNode } from '@comfyorg/litegraph'
import type { Positionable } from '@comfyorg/litegraph/dist/interfaces'

import { useSettingStore } from '@/stores/settingStore'

import { app } from '../../scripts/app'

function setNodeMode(node: LGraphNode, mode: number) {
  node.mode = mode
  node.graph?.change()
}

function addNodesToGroup(group: LGraphGroup, items: Iterable<Positionable>) {
  const padding = useSettingStore().get('Comfy.GroupSelectedNodes.Padding')
  group.resizeTo([...group.children, ...items], padding)
}

app.registerExtension({
  name: 'Comfy.GroupOptions',
  setup() {
    const orig = LGraphCanvas.prototype.getCanvasMenuOptions
    // graph_mouse
    LGraphCanvas.prototype.getCanvasMenuOptions = function (
      this: LGraphCanvas
    ) {
      // @ts-expect-error fixme ts strict error
      const options = orig.apply(this, arguments)
      // @ts-expect-error fixme ts strict error
      const group = this.graph.getGroupOnPos(
        this.graph_mouse[0],
        this.graph_mouse[1]
      )
      if (!group) {
        if (this.selectedItems.size > 0) {
          options.push({
            content: 'Add Group For Selected Nodes',
            callback: () => {
              const group = new LGraphGroup()
              addNodesToGroup(group, this.selectedItems)
              // @ts-expect-error fixme ts strict error
              this.graph.add(group)
              // @ts-expect-error fixme ts strict error
              this.graph.change()
            }
          })
        }

        return options
      }

      // Group nodes aren't recomputed until the group is moved, this ensures the nodes are up-to-date
      group.recomputeInsideNodes()
      const nodesInGroup = group.nodes

      options.push({
        content: 'Add Selected Nodes To Group',
        disabled: !this.selectedItems?.size,
        callback: () => {
          addNodesToGroup(group, this.selectedItems)
          // @ts-expect-error fixme ts strict error
          this.graph.change()
        }
      })

      // No nodes in group, return default options
      if (nodesInGroup.length === 0) {
        return options
      } else {
        // Add a separator between the default options and the group options
        // @ts-expect-error fixme ts strict error
        options.push(null)
      }

      // Check if all nodes are the same mode
      let allNodesAreSameMode = true
      for (let i = 1; i < nodesInGroup.length; i++) {
        if (nodesInGroup[i].mode !== nodesInGroup[0].mode) {
          allNodesAreSameMode = false
          break
        }
      }

      options.push({
        content: 'Fit Group To Nodes',
        callback: () => {
          group.recomputeInsideNodes()
          const padding = useSettingStore().get(
            'Comfy.GroupSelectedNodes.Padding'
          )
          group.resizeTo(group.children, padding)
          // @ts-expect-error fixme ts strict error
          this.graph.change()
        }
      })

      options.push({
        content: 'Select Nodes',
        callback: () => {
          this.selectNodes(nodesInGroup)
          // @ts-expect-error fixme ts strict error
          this.graph.change()
          this.canvas.focus()
        }
      })

      // Modes
      // 0: Always
      // 1: On Event
      // 2: Never
      // 3: On Trigger
      // 4: Bypass
      // If all nodes are the same mode, add a menu option to change the mode
      if (allNodesAreSameMode) {
        const mode = nodesInGroup[0].mode
        switch (mode) {
          case 0:
            // All nodes are always, option to disable, and bypass
            options.push({
              content: 'Set Group Nodes to Never',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 2)
                }
              }
            })
            options.push({
              content: 'Bypass Group Nodes',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 4)
                }
              }
            })
            break
          case 2:
            // All nodes are never, option to enable, and bypass
            options.push({
              content: 'Set Group Nodes to Always',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 0)
                }
              }
            })
            options.push({
              content: 'Bypass Group Nodes',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 4)
                }
              }
            })
            break
          case 4:
            // All nodes are bypass, option to enable, and disable
            options.push({
              content: 'Set Group Nodes to Always',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 0)
                }
              }
            })
            options.push({
              content: 'Set Group Nodes to Never',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 2)
                }
              }
            })
            break
          default:
            // All nodes are On Trigger or On Event(Or other?), option to disable, set to always, or bypass
            options.push({
              content: 'Set Group Nodes to Always',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 0)
                }
              }
            })
            options.push({
              content: 'Set Group Nodes to Never',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 2)
                }
              }
            })
            options.push({
              content: 'Bypass Group Nodes',
              callback: () => {
                for (const node of nodesInGroup) {
                  setNodeMode(node, 4)
                }
              }
            })
            break
        }
      } else {
        // Nodes are not all the same mode, add a menu option to change the mode to always, never, or bypass
        options.push({
          content: 'Set Group Nodes to Always',
          callback: () => {
            for (const node of nodesInGroup) {
              setNodeMode(node, 0)
            }
          }
        })
        options.push({
          content: 'Set Group Nodes to Never',
          callback: () => {
            for (const node of nodesInGroup) {
              setNodeMode(node, 2)
            }
          }
        })
        options.push({
          content: 'Bypass Group Nodes',
          callback: () => {
            for (const node of nodesInGroup) {
              setNodeMode(node, 4)
            }
          }
        })
      }

      return options
    }
  }
})
