import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import type { ComfyExtension } from '@/types/comfy'

export const goToNodeExtension: ComfyExtension = {
  name: 'Comfy.GoToNode',

  getCanvasMenuItems(_canvas: LGraphCanvas): IContextMenuValue[] {
    return [
      {
        content: 'Go to Node',
        callback: () => {
          void useCommandStore().execute('Comfy.Canvas.GoToNode')
        }
      }
    ]
  }
}
