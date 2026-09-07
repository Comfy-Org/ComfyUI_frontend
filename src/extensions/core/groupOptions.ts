import type {
  IContextMenuValue,
  Positionable
} from '@/lib/litegraph/src/interfaces'
import { LGraphEventMode, LGraphGroup } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyExtension } from '@/types/comfy'

import { app } from '../../scripts/app'

function setNodeMode(node: LGraphNode, mode: LGraphEventMode) {
  node.mode = mode
  node.graph?.change()
}

const MODE_MENU_ITEMS = [
  { content: 'Set Group Nodes to Always', mode: LGraphEventMode.ALWAYS },
  { content: 'Set Group Nodes to Never', mode: LGraphEventMode.NEVER },
  { content: 'Bypass Group Nodes', mode: LGraphEventMode.BYPASS }
] as const

function addNodesToGroup(group: LGraphGroup, items: Iterable<Positionable>) {
  const padding = useSettingStore().get('Comfy.GroupSelectedNodes.Padding')
  group.resizeTo([...group.children, ...items], padding)
}

const ext: ComfyExtension = {
  name: 'Comfy.GroupOptions',

  getCanvasMenuItems(canvas: LGraphCanvas): IContextMenuValue[] {
    const items: IContextMenuValue[] = []

    // @ts-expect-error fixme ts strict error
    const group = canvas.graph.getGroupOnPos(
      canvas.graph_mouse[0],
      canvas.graph_mouse[1]
    )

    if (!group) {
      if (canvas.selectedItems.size > 0) {
        items.push({
          content: 'Add Group For Selected Nodes',
          callback: () => {
            const group = new LGraphGroup()
            addNodesToGroup(group, canvas.selectedItems)
            // @ts-expect-error fixme ts strict error
            canvas.graph.add(group)
            // @ts-expect-error fixme ts strict error
            canvas.graph.change()

            group.recomputeInsideNodes()
          }
        })
      }

      return items
    }

    // Group nodes aren't recomputed until the group is moved, this ensures the nodes are up-to-date
    group.recomputeInsideNodes()
    const nodesInGroup = group.nodes

    items.push({
      content: 'Add Selected Nodes To Group',
      disabled: !canvas.selectedItems?.size,
      callback: () => {
        addNodesToGroup(group, canvas.selectedItems)
        // @ts-expect-error fixme ts strict error
        canvas.graph.change()
      }
    })

    // No nodes in group, return default options
    if (nodesInGroup.length === 0) {
      return items
    } else {
      // Add a separator between the default options and the group options
      // @ts-expect-error fixme ts strict error
      items.push(null)
    }

    const firstMode = nodesInGroup[0].mode
    const sharedMode = nodesInGroup.every((node) => node.mode === firstMode)
      ? firstMode
      : undefined

    items.push({
      content: 'Fit Group To Nodes',
      callback: () => {
        group.recomputeInsideNodes()
        const padding = useSettingStore().get(
          'Comfy.GroupSelectedNodes.Padding'
        )
        group.resizeTo(group.children, padding)
        // @ts-expect-error fixme ts strict error
        canvas.graph.change()
      }
    })

    items.push({
      content: 'Select Nodes',
      callback: () => {
        canvas.selectNodes(nodesInGroup)
        // @ts-expect-error fixme ts strict error
        canvas.graph.change()
        canvas.canvas.focus()
      }
    })

    for (const { content, mode } of MODE_MENU_ITEMS) {
      if (mode === sharedMode) continue

      items.push({
        content,
        callback: () => {
          for (const node of nodesInGroup) {
            setNodeMode(node, mode)
          }
        }
      })
    }

    return items
  }
}

app.registerExtension(ext)
