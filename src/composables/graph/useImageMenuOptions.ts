import { useI18n } from 'vue-i18n'

import { downloadFile, openFileInNewTab } from '@/base/common/downloadUtil'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useNodeOutputsExport } from '@/platform/assets/integration/useNodeOutputsExport'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { copyImageToClipboard } from '@/renderer/core/clipboard/mediaClipboard'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { clipspace } from '@/scripts/clipspace'
import { getImageFileUrl } from '@/utils/hdrFormatUtil'
import { isImageNode } from '@/utils/litegraphUtil'

import type { MenuOption } from './menuOption'

type ImageMenuAvailability = { input: boolean; preview: boolean }

const DEFAULT_IMAGE_MENU_AVAILABILITY: ImageMenuAvailability = {
  input: true,
  preview: true
}

function canPasteImage(node?: LGraphNode): boolean {
  return typeof node?.pasteFiles === 'function'
}

async function pasteClipboardImageToNode(node: LGraphNode): Promise<void> {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith('image/'))
      if (!imageType) continue

      const blob = await item.getType(imageType)
      const ext = imageType.split('/')[1] ?? 'png'
      const file = new File([blob], `pasted-image.${ext}`, {
        type: imageType
      })
      node.pasteFile?.(file)
      node.pasteFiles?.([file])
      return
    }
  } catch (error) {
    console.error('Failed to paste image from clipboard:', error)
  }
}

export function useImageMenuOptions() {
  const { t } = useI18n()
  const { hasMultipleOutputs, showOutputsExportDialog } = useNodeOutputsExport()
  const nodeOutputStore = useNodeOutputStore()
  const settingStore = useSettingStore()

  const showsSingleImage = (node: LGraphNode) =>
    isImageNode(node) &&
    nodeOutputStore.getNodeOutputs(node)?.images?.length === 1

  const toggleFullResolutionPreview = (node: LGraphNode) => {
    node.flags.fullResolutionPreview = node.flags.fullResolutionPreview
      ? undefined
      : true
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  }

  const openMaskEditor = () => {
    const commandStore = useCommandStore()
    void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
  }

  const openImage = (node: LGraphNode) => {
    const images = node.imgs
    if (!images?.length) return
    const img = images.at(node.imageIndex ?? 0)
    if (!img) return
    const url = getImageFileUrl(img)
    void openFileInNewTab(url.toString())
  }

  const copyImage = async (node: LGraphNode) => {
    const img = node.imgs?.at(node.imageIndex ?? 0)
    if (img) await copyImageToClipboard(img)
  }

  const saveImage = (node: LGraphNode) => {
    const images = node.imgs
    if (!images?.length) return
    const img = images.at(node.imageIndex ?? 0)
    if (!img) return

    try {
      const url = getImageFileUrl(img)
      downloadFile(url.toString(), undefined, 'canvas_menu')
    } catch (error) {
      console.error('Failed to save image:', error)
    }
  }

  const getImageMenuOptions = (
    node: LGraphNode,
    availability: ImageMenuAvailability = DEFAULT_IMAGE_MENU_AVAILABILITY
  ): MenuOption[] => {
    const hasPreview = availability.preview && !!node.imgs?.length
    const canEdit =
      hasPreview ||
      (availability.preview && isImageNode(node) && !clipspace.returnNode)
    const canPaste = canPasteImage(node)
    const canExportOutputs = availability.preview && hasMultipleOutputs(node)

    const options: [boolean, MenuOption][] = [
      [
        hasPreview,
        {
          id: 'openImage',
          label: t('contextMenu.Open Image'),
          icon: 'icon-[lucide--external-link]',
          action: () => openImage(node)
        }
      ],
      [
        canEdit,
        {
          id: 'maskEditor',
          label: t('contextMenu.Open in Mask Editor'),
          icon: 'icon-[comfy--mask]',
          action: () => openMaskEditor()
        }
      ],
      [
        hasPreview,
        {
          id: 'copyImage',
          label: t('contextMenu.Copy Image'),
          icon: 'icon-[lucide--copy]',
          action: () => copyImage(node)
        }
      ],
      [
        canPaste && availability.input,
        {
          id: 'pasteImage',
          label: t('contextMenu.Paste Image'),
          icon: 'icon-[lucide--clipboard-paste]',
          action: () => pasteClipboardImageToNode(node)
        }
      ],
      [
        hasPreview,
        {
          id: 'saveImage',
          label: t('contextMenu.Save Image'),
          icon: 'icon-[lucide--download]',
          action: () => saveImage(node)
        }
      ],
      [
        canExportOutputs,
        {
          id: 'downloadImages',
          label: t('contextMenu.Download Images'),
          icon: 'icon-[lucide--folder-down]',
          action: () => showOutputsExportDialog(node)
        }
      ]
    ]

    return options.flatMap(([available, option]) => (available ? [option] : []))
  }

  const getPreviewResolutionOption = (
    node: LGraphNode
  ): MenuOption | undefined => {
    if (
      !LiteGraph.vueNodesMode ||
      !settingStore.get('Comfy.Node.DownscaleImagePreviews') ||
      !showsSingleImage(node)
    )
      return
    return node.flags.fullResolutionPreview
      ? {
          id: 'previewResolution',
          label: t('contextMenu.Show Downscaled Preview'),
          icon: 'icon-[lucide--image-down]',
          action: () => toggleFullResolutionPreview(node)
        }
      : {
          id: 'previewResolution',
          label: t('contextMenu.Show Full Resolution'),
          icon: 'icon-[lucide--image-upscale]',
          action: () => toggleFullResolutionPreview(node)
        }
  }

  return {
    getImageMenuOptions,
    getPreviewResolutionOption
  }
}
