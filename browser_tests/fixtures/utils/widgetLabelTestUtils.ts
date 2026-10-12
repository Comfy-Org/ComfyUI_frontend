import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { NodeId } from '@/types/nodeId'

export const RENAMED_LABEL = 'Renamed Widget Label'
const WIDGET_NAME = 'text'

/**
 * Apply a renamed label to the first CLIPTextEncode `text` widget and return the
 * node id.
 *
 * Writes the display `label` plus the backing `input.label` (matched by widget
 * name) directly — the channel the label persists through — because the
 * regression (#13861) is in persistence, not the rename UI. A normal-node input
 * carries no `widgetId`, so the fixed `renameWidget` now mirrors the label onto
 * `input.label` via a name-based lookup; this helper reproduces that same effect
 * so the serialize/configure round-trip is genuinely exercised.
 */
export function renameFirstTextWidget(comfyPage: ComfyPage): Promise<NodeId> {
  return comfyPage.page.evaluate(
    ({ widgetName, label }) => {
      const node = window.app!.graph.nodes.find(
        (n) => n.type === 'CLIPTextEncode'
      )!
      const widget = node.widgets!.find((w) => w.name === widgetName)!
      const input = node.inputs.find((i) => i.widget?.name === widget.name)
      if (!input)
        throw new Error('expected a backing input for the text widget')
      widget.label = label
      input.label = label
      return node.id
    },
    { widgetName: WIDGET_NAME, label: RENAMED_LABEL }
  )
}

export function countNodesWithRenamedLabel(
  comfyPage: ComfyPage
): Promise<number> {
  return comfyPage.page.evaluate(
    ({ widgetName, label }) =>
      window.app!.graph.nodes.filter(
        (n) =>
          n.type === 'CLIPTextEncode' &&
          n.widgets?.find((w) => w.name === widgetName)?.label === label
      ).length,
    { widgetName: WIDGET_NAME, label: RENAMED_LABEL }
  )
}

export function nodeExists(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<boolean> {
  return comfyPage.page.evaluate(
    (id) => !!window.app!.graph.getNodeById(id),
    nodeId
  )
}

export function labelForNode(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<string | undefined> {
  return comfyPage.page.evaluate(
    ({ id, widgetName }) =>
      window
        .app!.graph.getNodeById(id)
        ?.widgets?.find((w) => w.name === widgetName)?.label,
    { id: nodeId, widgetName: WIDGET_NAME }
  )
}
