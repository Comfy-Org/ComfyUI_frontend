import { getErrorMessage } from '@comfyorg/shared-frontend-utils/errorUtil'
import { useI18n } from 'vue-i18n'

import { downloadFile, openFileInNewTab } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useNodeOutputsExport } from '@/platform/assets/composables/useNodeOutputsExport'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { CoreMediaMenuActionKind } from '@/utils/coreMediaMenuActionUtils'
import { fullResolutionSrc, getImageFileUrl } from '@/utils/hdrFormatUtil'
import { isImageNode } from '@/utils/litegraphUtil'

import type { MenuOption } from './menuOption'

type ImageMenuAvailability = Record<CoreMediaMenuActionKind, boolean>

const DEFAULT_IMAGE_MENU_AVAILABILITY: ImageMenuAvailability = {
  input: true,
  preview: true
}

function canPasteImage(node?: LGraphNode): boolean {
  return typeof node?.pasteFiles === 'function'
}

async function fullResolutionImage(
  img: HTMLImageElement
): Promise<HTMLImageElement | undefined> {
  const src = fullResolutionSrc(img)
  if (src === img.src) return img
  const full = new Image()
  full.src = src
  try {
    await full.decode()
    return full
  } catch {
    return undefined
  }
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
  const toast = useToast()
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
    const images = node.imgs
    if (!images?.length) return
    const img = images.at(node.imageIndex ?? 0)
    if (!img) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const source = await fullResolutionImage(img)
    if (!source) {
      toast.warning(
        t('toastMessages.errorCopyImage', { error: t('g.unknownError') })
      )
      return
    }

    try {
      canvas.width = source.naturalWidth
      canvas.height = source.naturalHeight
      ctx.drawImage(source, 0, 0)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })

      if (!blob) {
        console.warn('Failed to create image blob')
        return
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
    } catch (error) {
      toast.warning(
        t('toastMessages.errorCopyImage', {
          error: getErrorMessage(error) ?? t('g.unknownError')
        })
      )
    }
  }

  const saveImage = (node: LGraphNode) => {
    const images = node.imgs
    if (!images?.length) return
    const img = images.at(node.imageIndex ?? 0)
    if (!img) return

    try {
      const url = getImageFileUrl(img)
      downloadFile(url.toString())
    } catch (error) {
      console.error('Failed to save image:', error)
    }
  }

  const getImageMenuOptions = (
    node: LGraphNode,
    availability: ImageMenuAvailability = DEFAULT_IMAGE_MENU_AVAILABILITY
  ): MenuOption[] => {
    const hasImages = !!node.imgs?.length
    const canPaste = canPasteImage(node)
    const canExportOutputs = availability.preview && hasMultipleOutputs(node)
    if (
      (!hasImages || !availability.preview) &&
      (!canPaste || !availability.input) &&
      !canExportOutputs
    )
      return []

    const options: MenuOption[] = []

    if (hasImages && availability.preview) {
      options.push(
        {
          id: 'openImage',
          label: t('contextMenu.Open Image'),
          icon: 'icon-[lucide--external-link]',
          action: () => openImage(node)
        },
        {
          id: 'maskEditor',
          label: t('contextMenu.Open in Mask Editor'),
          icon: 'icon-[comfy--mask]',
          action: () => openMaskEditor()
        },
        {
          id: 'copyImage',
          label: t('contextMenu.Copy Image'),
          icon: 'icon-[lucide--copy]',
          action: () => copyImage(node)
        }
      )
    }

    if (canPaste && availability.input) {
      options.push({
        id: 'pasteImage',
        label: t('contextMenu.Paste Image'),
        icon: 'icon-[lucide--clipboard-paste]',
        action: () => pasteClipboardImageToNode(node)
      })
    }

    if (hasImages && availability.preview) {
      options.push({
        id: 'saveImage',
        label: t('contextMenu.Save Image'),
        icon: 'icon-[lucide--download]',
        action: () => saveImage(node)
      })
    }

    if (canExportOutputs) {
      options.push({
        id: 'downloadImages',
        label: t('contextMenu.Download Images'),
        icon: 'icon-[lucide--folder-down]',
        action: () => showOutputsExportDialog(node)
      })
    }

    return options
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
