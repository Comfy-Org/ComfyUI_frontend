import { t } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeMenuItemId } from '@/lib/litegraph/src/types/nodeMenu'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  canHavePreview,
  chosenPreviewDisplay,
  setPreviewDisplay
} from '@/systems/nodePreviewSystem'
import type { PreviewDisplay } from '@/systems/nodePreviewSystem'

import { fitCanvasPreviewZone } from './subgraphActivityPreview'

const CHOICES = [
  {
    id: 'previewShown',
    display: 'shown',
    label: 'contextMenu.Show Preview Zone',
    icon: 'icon-[lucide--square-dashed]'
  },
  {
    id: 'previewHidden',
    display: 'hidden',
    label: 'contextMenu.Hide Preview',
    icon: 'icon-[lucide--eye-off]'
  },
  {
    id: 'previewAuto',
    display: 'auto',
    label: 'contextMenu.Show Preview Automatically',
    icon: 'icon-[lucide--eye]'
  }
] as const satisfies ReadonlyArray<{
  id: NodeMenuItemId
  display: PreviewDisplay
  label: string
  icon: string
}>

function choosePreviewDisplay(node: LGraphNode, display: PreviewDisplay) {
  setPreviewDisplay(node, display)
  if (display === 'shown' && !LiteGraph.vueNodesMode) fitCanvasPreviewZone(node)
  node.setDirtyCanvas(true, true)
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}

/** The preview displays the user can switch `node` to, other than its current one. */
export function previewDisplayChoices(node: LGraphNode): Array<{
  id: NodeMenuItemId
  label: string
  icon: string
  choose: () => void
}> {
  if (!node.isSubgraphNode() && !canHavePreview(node)) return []
  const current = chosenPreviewDisplay(node)
  return CHOICES.filter(({ display }) => display !== current).map(
    ({ id, display, label, icon }) => ({
      id,
      label: t(label),
      icon,
      choose: () => choosePreviewDisplay(node, display)
    })
  )
}
