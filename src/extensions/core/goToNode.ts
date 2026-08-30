import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import type { ComfyExtension } from '@/types/comfy'

const ext: ComfyExtension = {
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

app.registerExtension(ext)
