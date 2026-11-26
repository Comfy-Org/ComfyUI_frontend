import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { isSelectOnly } from '@/utils/litegraphUtil'

/**
 * Extract & Promisify Litegraph.createNode to allow for positioning
 * @param canvas
 * @param name
 */
export async function createNode(
  canvas: LGraphCanvas,
  name: string
): Promise<LGraphNode | null> {
  if (!name) {
    return null
  }
  if (isSelectOnly(canvas)) {
    return null
  }

  const {
    graph,
    graph_mouse: [posX, posY]
  } = canvas
  const newNode = LiteGraph.createNode(name)
  await new Promise((r) => setTimeout(r, 0))

  if (newNode && graph) {
    newNode.pos = [posX, posY]
    const addedNode = graph.add(newNode) ?? null

    if (addedNode) {
      useNodeZIndex().bringNodeToFront(addedNode.id)
      graph.change()
    }
    return addedNode
  } else {
    useToast().warning(t('assetBrowser.failedToCreateNode'))
    return null
  }
}
