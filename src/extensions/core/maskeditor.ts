import _ from 'es-toolkit/compat'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { app, ComfyApp } from '@/scripts/app'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import { ClipspaceDialog } from './clipspace'

function openMaskEditor(node: LGraphNode): void {
  if (!node) {
    console.error('[MaskEditor] No node provided')
    return
  }

  if (!node.imgs?.length && node.previewMediaType !== 'image') {
    console.error('[MaskEditor] Node has no images')
    return
  }

  useMaskEditor().openMaskEditor(node)
}

// Open mask editor from clipspace (for plugin compatibility)
// This is called when ComfyApp.open_maskeditor() is invoked without arguments
function openMaskEditorFromClipspace(): void {
  const node = ComfyApp.clipspace_return_node as LGraphNode | null
  if (!node) {
    console.error('[MaskEditor] No clipspace_return_node found')
    return
  }

  openMaskEditor(node)
}

// Check if the dialog is already opened
function isOpened(): boolean {
  return useDialogStore().isDialogOpen('global-mask-editor')
}

// Context predicate for ClipspaceDialog button
function contextPredicate(): boolean {
  return !!(
    ComfyApp.clipspace &&
    ComfyApp.clipspace.imgs &&
    ComfyApp.clipspace.imgs.length > 0
  )
}

app.registerExtension({
  name: 'Comfy.MaskEditor',
  settings: [
    {
      id: 'Comfy.MaskEditor.BrushAdjustmentSpeed',
      category: ['Mask Editor', 'BrushAdjustment', 'Sensitivity'],
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
      id: 'Comfy.MaskEditor.UseDominantAxis',
      category: ['Mask Editor', 'BrushAdjustment', 'UseDominantAxis'],
      name: 'Lock brush adjustment to dominant axis',
      tooltip:
        'When enabled, brush adjustments will only affect size OR hardness based on which direction you move more',
      type: 'boolean',
      defaultValue: true
    }
  ],
  commands: [
    {
      id: 'Comfy.MaskEditor.OpenMaskEditor',
      icon: 'pi pi-pencil',
      label: 'Open Mask Editor for Selected Node',
      function: () => {
        const selectedNodes = app.canvas.selected_nodes
        if (!selectedNodes || Object.keys(selectedNodes).length !== 1) return

        const selectedNode = selectedNodes[Object.keys(selectedNodes)[0]]
        openMaskEditor(selectedNode)
      }
    },
    {
      id: 'Comfy.MaskEditor.BrushSize.Increase',
      icon: 'pi pi-plus-circle',
      label: 'Increase Brush Size in MaskEditor',
      function: () => changeBrushSize((old) => _.clamp(old + 4, 1, 100))
    },
    {
      id: 'Comfy.MaskEditor.BrushSize.Decrease',
      icon: 'pi pi-minus-circle',
      label: 'Decrease Brush Size in MaskEditor',
      function: () => changeBrushSize((old) => _.clamp(old - 4, 1, 100))
    }
  ],
  init() {
    // Set up ComfyApp static methods for plugin compatibility (deprecated)
    ComfyApp.open_maskeditor = openMaskEditorFromClipspace
    ComfyApp.maskeditor_is_opended = isOpened
    console.warn(
      '[MaskEditor] ComfyApp.open_maskeditor and ComfyApp.maskeditor_is_opended are deprecated. ' +
        'Plugins should migrate to using the command system or direct node context menu integration.'
    )

    // Register button in ClipspaceDialog
    ClipspaceDialog.registerButton(
      'MaskEditor',
      contextPredicate,
      openMaskEditorFromClipspace
    )
  }
})

const changeBrushSize = async (sizeChanger: (oldSize: number) => number) => {
  if (!isOpened()) return

  const store = useMaskEditorStore()
  const oldBrushSize = store.brushSettings.size
  const newBrushSize = sizeChanger(oldBrushSize)
  store.setBrushSize(newBrushSize)
}
