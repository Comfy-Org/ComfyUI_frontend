import _ from 'es-toolkit/compat'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { app, ComfyApp } from '@/scripts/app'
import { useimageCanvasStore } from '@/stores/imageCanvasStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useimageCanvas } from '@/composables/imageCanvas/useimageCanvas'
import { useCanvasTransform } from '@/composables/imageCanvas/useCanvasTransform'

function openimageCanvas(node: LGraphNode): void {
  if (!node) {
    console.error('[imageCanvas] No node provided')
    return
  }

  if (!node.imgs?.length && node.previewMediaType !== 'image') {
    console.error('[imageCanvas] Node has no images')
    return
  }

  useimageCanvas().openimageCanvas(node)
}

// Open Image Canvas from clipspace (for plugin compatibility)
// This is called when ComfyApp.open_imageCanvas() is invoked without arguments
function openimageCanvasFromClipspace(): void {
  const node = ComfyApp.clipspace_return_node as LGraphNode | null
  if (!node) {
    console.error('[imageCanvas] No clipspace_return_node found')
    return
  }

  openimageCanvas(node)
}

// Check if the dialog is already opened
function isOpened(): boolean {
  return useDialogStore().isDialogOpen('global-image-canvas')
}

const changeBrushSize = async (sizeChanger: (oldSize: number) => number) => {
  if (!isOpened()) return

  const store = useimageCanvasStore()
  const oldBrushSize = store.brushSettings.size
  const newBrushSize = sizeChanger(oldBrushSize)
  store.setBrushSize(newBrushSize)
}

app.registerExtension({
  name: 'Comfy.imageCanvas',
  settings: [
    {
      id: 'Comfy.imageCanvas.BrushAdjustmentSpeed',
      category: ['Image Canvas', 'BrushAdjustment', 'Sensitivity'],
      name: 'Brush adjustment speed multiplier',
      tooltip:
        'Controls how quickly the brush size and hardness change when adjusting. Higher values mean faster changes.',
      type: 'slider',
      attrs: {
        min: 0.1,
        max: 2.0,
        step: 0.1
      },
      defaultValue: 1.0,
      versionAdded: '1.0.0'
    },
    {
      id: 'Comfy.imageCanvas.UseDominantAxis',
      category: ['Image Canvas', 'BrushAdjustment', 'UseDominantAxis'],
      name: 'Lock brush adjustment to dominant axis',
      tooltip:
        'When enabled, brush adjustments will only affect size OR hardness based on which direction you move more',
      type: 'boolean',
      defaultValue: true
    }
  ],
  commands: [
    {
      id: 'Comfy.imageCanvas.OpenimageCanvas',
      icon: 'pi pi-pencil',
      label: 'Open Image Canvas for Selected Node',
      function: () => {
        const selectedNodes = app.canvas.selected_nodes
        if (!selectedNodes || Object.keys(selectedNodes).length !== 1) return

        const selectedNode = selectedNodes[Object.keys(selectedNodes)[0]]
        openimageCanvas(selectedNode)
      }
    },
    {
      id: 'Comfy.imageCanvas.BrushSize.Increase',
      icon: 'pi pi-plus-circle',
      label: 'Increase Brush Size in Image Canvas',
      function: () => changeBrushSize((old) => _.clamp(old + 2, 1, 250))
    },
    {
      id: 'Comfy.imageCanvas.BrushSize.Decrease',
      icon: 'pi pi-minus-circle',
      label: 'Decrease Brush Size in Image Canvas',
      function: () => changeBrushSize((old) => _.clamp(old - 2, 1, 250))
    },
    {
      id: 'Comfy.imageCanvas.ColorPicker',
      icon: 'pi pi-palette',
      label: 'Open Color Picker in Image Canvas',
      function: () => {
        if (!isOpened()) return

        const store = useimageCanvasStore()
        store.colorInput?.click()
      }
    },
    {
      id: 'Comfy.imageCanvas.Rotate.Right',
      icon: 'pi pi-refresh',
      label: 'Rotate Right in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().rotateClockwise()
      }
    },
    {
      id: 'Comfy.imageCanvas.Rotate.Left',
      icon: 'pi pi-undo',
      label: 'Rotate Left in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().rotateCounterclockwise()
      }
    },
    {
      id: 'Comfy.imageCanvas.Mirror.Horizontal',
      icon: 'pi pi-arrows-h',
      label: 'Mirror Horizontal in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().mirrorHorizontal()
      }
    },
    {
      id: 'Comfy.imageCanvas.Mirror.Vertical',
      icon: 'pi pi-arrows-v',
      label: 'Mirror Vertical in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().mirrorVertical()
      }
    }
  ],
  init() {
    // Set up ComfyApp static methods for plugin compatibility (deprecated)
    ComfyApp.open_imageCanvas = openimageCanvasFromClipspace

    console.warn(
      '[imageCanvas] ComfyApp.open_imageCanvas is deprecated. ' +
        'Plugins should migrate to using the command system or direct node context menu integration.'
    )
  }
})
