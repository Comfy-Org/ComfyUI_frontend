import _ from 'es-toolkit/compat'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { app, ComfyApp } from '@/scripts/app'
import { useImageCanvasStore } from '@/stores/imageCanvasStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useImageCanvas } from '@/composables/imagecanvas/useImageCanvas'
import { useCanvasTransform } from '@/composables/imagecanvas/useCanvasTransform'

function openImageCanvas(node: LGraphNode): void {
  if (!node) {
    console.error('[ImageCanvas] No node provided')
    return
  }

  if (!node.imgs?.length && node.previewMediaType !== 'image') {
    console.error('[ImageCanvas] Node has no images')
    return
  }

  useImageCanvas().openImageCanvas(node)
}

// Open image canvas from clipspace (for plugin compatibility)
// This is called when ComfyApp.open_imagecanvas() is invoked without arguments
function openImageCanvasFromClipspace(): void {
  const node = ComfyApp.clipspace_return_node as LGraphNode | null
  if (!node) {
    console.error('[ImageCanvas] No clipspace_return_node found')
    return
  }

  openImageCanvas(node)
}

// Check if the dialog is already opened
function isOpened(): boolean {
  return useDialogStore().isDialogOpen('global-image-canvas')
}

const changeBrushSize = async (sizeChanger: (oldSize: number) => number) => {
  if (!isOpened()) return

  const store = useImageCanvasStore()
  const oldBrushSize = store.brushSettings.size
  const newBrushSize = sizeChanger(oldBrushSize)
  store.setBrushSize(newBrushSize)
}

app.registerExtension({
  name: 'Comfy.ImageCanvas',
  settings: [
    {
      id: 'Comfy.ImageCanvas.BrushAdjustmentSpeed',
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
      id: 'Comfy.ImageCanvas.UseDominantAxis',
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
      id: 'Comfy.ImageCanvas.OpenImageCanvas',
      icon: 'pi pi-pencil',
      label: 'Open Image Canvas for Selected Node',
      function: () => {
        const selectedNodes = app.canvas.selected_nodes
        if (!selectedNodes || Object.keys(selectedNodes).length !== 1) return

        const selectedNode = selectedNodes[Object.keys(selectedNodes)[0]]
        openImageCanvas(selectedNode)
      }
    },
    {
      id: 'Comfy.ImageCanvas.BrushSize.Increase',
      icon: 'pi pi-plus-circle',
      label: 'Increase Brush Size in Image Canvas',
      function: () => changeBrushSize((old) => _.clamp(old + 2, 1, 250))
    },
    {
      id: 'Comfy.ImageCanvas.BrushSize.Decrease',
      icon: 'pi pi-minus-circle',
      label: 'Decrease Brush Size in Image Canvas',
      function: () => changeBrushSize((old) => _.clamp(old - 2, 1, 250))
    },
    {
      id: 'Comfy.ImageCanvas.ColorPicker',
      icon: 'pi pi-palette',
      label: 'Open Color Picker in Image Canvas',
      function: () => {
        if (!isOpened()) return

        const store = useImageCanvasStore()
        store.colorInput?.click()
      }
    },
    {
      id: 'Comfy.ImageCanvas.Rotate.Right',
      icon: 'pi pi-refresh',
      label: 'Rotate Right in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().rotateClockwise()
      }
    },
    {
      id: 'Comfy.ImageCanvas.Rotate.Left',
      icon: 'pi pi-undo',
      label: 'Rotate Left in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().rotateCounterclockwise()
      }
    },
    {
      id: 'Comfy.ImageCanvas.Mirror.Horizontal',
      icon: 'pi pi-arrows-h',
      label: 'Mirror Horizontal in Image Canvas',
      function: async () => {
        if (!isOpened()) return
        await useCanvasTransform().mirrorHorizontal()
      }
    },
    {
      id: 'Comfy.ImageCanvas.Mirror.Vertical',
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
    ComfyApp.open_imagecanvas = openImageCanvasFromClipspace

    console.warn(
      '[ImageCanvas] ComfyApp.open_imagecanvas is deprecated. ' +
        'Plugins should migrate to using the command system or direct node context menu integration.'
    )
  }
})
