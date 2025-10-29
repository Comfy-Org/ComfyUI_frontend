import _ from 'es-toolkit/compat'

import { app } from '../../scripts/app'
import { ComfyApp } from '../../scripts/app'
import { ClipspaceDialog } from './clipspace'
import { MaskEditorDialog } from './maskeditor/MaskEditorDialog'
import { MaskEditorDialogOld } from './maskEditorOld'

// Import styles to inject into document
import './maskeditor/styles'

// Function to open the mask editor
function openMaskEditor(): void {
  const useNewEditor = app.extensionManager.setting.get(
    'Comfy.MaskEditor.UseNewEditor'
  )
  if (useNewEditor) {
    const dlg = MaskEditorDialog.getInstance() as any
    if (dlg?.isOpened && !dlg.isOpened()) {
      dlg.show()
    }
  } else {
    const dlg = MaskEditorDialogOld.getInstance() as any
    if (dlg?.isOpened && !dlg.isOpened()) {
      dlg.show()
    }
  }
}

// Check if the dialog is already opened
function isOpened(): boolean {
  const useNewEditor = app.extensionManager.setting.get(
    'Comfy.MaskEditor.UseNewEditor'
  )
  if (useNewEditor) {
    return MaskEditorDialog.instance?.isOpened?.() ?? false
  } else {
    return (MaskEditorDialogOld.instance as any)?.isOpened?.() ?? false
  }
}

// Ensure boolean return type for context predicate
const context_predicate = (): boolean => {
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
      id: 'Comfy.MaskEditor.UseNewEditor',
      category: ['Mask Editor', 'NewEditor'],
      name: 'Use new mask editor',
      tooltip: 'Switch to the new mask editor interface',
      type: 'boolean',
      defaultValue: true,
      experimental: true
    },
    {
      id: 'Comfy.MaskEditor.BrushAdjustmentSpeed',
      category: ['Mask Editor', 'BrushAdjustment', 'Sensitivity'],
      name: 'Brush adjustment speed multiplier',
      tooltip:
        'Controls how quickly the brush size and hardness change when adjusting. Higher values mean faster changes.',
      experimental: true,
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
      defaultValue: true,
      experimental: true
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
        if (
          !selectedNode.imgs?.length &&
          selectedNode.previewMediaType !== 'image'
        )
          return
        ComfyApp.copyToClipspace(selectedNode)
        // @ts-expect-error clipspace_return_node is an extension property added at runtime
        ComfyApp.clipspace_return_node = selectedNode
        openMaskEditor()
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
    ComfyApp.open_maskeditor = openMaskEditor
    ComfyApp.maskeditor_is_opended = isOpened

    ClipspaceDialog.registerButton(
      'MaskEditor',
      context_predicate,
      openMaskEditor
    )
  }
})

const changeBrushSize = async (sizeChanger: (oldSize: number) => number) => {
  if (!isOpened()) return
  const maskEditor = MaskEditorDialog.getInstance()
  if (!maskEditor) return
  const messageBroker = maskEditor.getMessageBroker()
  const oldBrushSize = (await messageBroker.pull('brushSettings')).size
  const newBrushSize = sizeChanger(oldBrushSize)
  messageBroker.publish('setBrushSize', newBrushSize)
  messageBroker.publish('updateBrushPreview')
}
