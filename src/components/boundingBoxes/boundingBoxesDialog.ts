import BoundingBoxesDialogContent from '@/components/boundingBoxes/BoundingBoxesDialogContent.vue'
import BoundingBoxesDialogHeader from '@/components/boundingBoxes/BoundingBoxesDialogHeader.vue'
import type { DialogComponentProps } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const BOUNDING_BOXES_DIALOG_KEY = 'global-bounding-boxes-editor'

const boundingBoxesDialogProps = {
  flush: true,
  size: 'full',
  maximizable: false,
  maximized: true,
  closable: true,
  showCloseButton: false,
  dismissOnPointerDownOutside: false
} satisfies DialogComponentProps

export function openBoundingBoxesDialog(
  nodeId: NodeId,
  widget: SimplifiedWidget
) {
  useDialogStore().showDialog({
    key: BOUNDING_BOXES_DIALOG_KEY,
    headerComponent: BoundingBoxesDialogHeader,
    component: BoundingBoxesDialogContent,
    props: {
      nodeId,
      widget,
      close: () =>
        useDialogStore().closeDialog({ key: BOUNDING_BOXES_DIALOG_KEY })
    },
    dialogComponentProps: boundingBoxesDialogProps
  })
}
