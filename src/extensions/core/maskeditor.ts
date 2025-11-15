import _ from 'es-toolkit/compat'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { app } from '@/scripts/app'
import { ComfyApp } from '@/scripts/app'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useDialogStore } from '@/stores/dialogStore'
import MaskEditorContent from '@/components/maskeditor/MaskEditorContent.vue'
import TopBarHeader from '@/components/maskeditor/dialog/TopBarHeader.vue'
import { MaskEditorDialogOld } from './maskEditorOld'
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

  const useNewEditor = app.extensionManager.setting.get(
    'Comfy.MaskEditor.UseNewEditor'
  )

  if (useNewEditor) {
    // Use new refactored editor
    useDialogStore().showDialog({
      key: 'global-mask-editor',
      headerComponent: TopBarHeader,
      component: MaskEditorContent,
      props: {
        node
      },
      dialogComponentProps: {
        style: 'width: 90vw; height: 90vh;',
        modal: true,
        maximizable: true,
        closable: true,
        pt: {
          root: {
            class: 'mask-editor-dialog flex flex-col'
          },
          content: {
            class: 'flex flex-col min-h-0 flex-1 !p-0'
          },
          header: {
            class: '!p-2'
          }
        }
      }
    })
  } else {
    // Use old editor
    ComfyApp.copyToClipspace(node)
    // @ts-expect-error clipspace_return_node is an extension property added at runtime
    ComfyApp.clipspace_return_node = node
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
    return useDialogStore().isDialogOpen('global-mask-editor')
  } else {
    return (MaskEditorDialogOld.instance as any)?.isOpened?.() ?? false
  }
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
    // Support for old editor clipspace integration
    const openMaskEditorFromClipspace = () => {
      const useNewEditor = app.extensionManager.setting.get(
        'Comfy.MaskEditor.UseNewEditor'
      )
      if (!useNewEditor) {
        const dlg = MaskEditorDialogOld.getInstance() as any
        if (dlg?.isOpened && !dlg.isOpened()) {
          dlg.show()
        }
      }
    }

    const context_predicate = (): boolean => {
      return !!(
        ComfyApp.clipspace &&
        ComfyApp.clipspace.imgs &&
        ComfyApp.clipspace.imgs.length > 0
      )
    }

    ClipspaceDialog.registerButton(
      'MaskEditor',
      context_predicate,
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
