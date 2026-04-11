import { useI18n } from 'vue-i18n'

import { downloadFile, openFileInNewTab } from '@/base/common/downloadUtil'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import type { MenuOption } from './useMoreOptionsMenu'

function canPasteImage(node?: LGraphNode): boolean {
  return typeof node?.pasteFiles === 'function'
}

async function pasteClipboardImageToNode(node: LGraphNode): Promise<void> {
  if (!navigator.clipboard?.read) {
    console.warn('Clipboard API not available')
    return
  }

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

/**
 * Composable for image-related menu operations
 */
export function useImageMenuOptions() {
  const { t } = useI18n()
  const maskEditor = useMaskEditor()

  const openMaskEditorForNode = (node: LGraphNode) => {
    maskEditor.openMaskEditor(node)
  }

  const openImage = (node: LGraphNode) => {
    if (!node?.imgs?.length) return
    const img = node.imgs[node.imageIndex ?? 0]
    if (!img) return
    const url = new URL(img.src)
    url.searchParams.delete('preview')
    void openFileInNewTab(url.toString())
  }

  const copyImage = async (node: LGraphNode) => {
    if (!node?.imgs?.length) return
    const img = node.imgs[node.imageIndex ?? 0]
    if (!img) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })

      if (!blob) {
        console.warn('Failed to create image blob')
        return
      }

      // Check if clipboard API is available
      if (!navigator.clipboard?.write) {
        console.warn('Clipboard API not available')
        return
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error)
    }
  }

  const saveImage = (node: LGraphNode) => {
    if (!node?.imgs?.length) return
    const img = node.imgs[node.imageIndex ?? 0]
    if (!img) return

    try {
      const url = new URL(img.src)
      url.searchParams.delete('preview')
      downloadFile(url.toString())
    } catch (error) {
      console.error('Failed to save image:', error)
    }
  }

  const getImageMenuOptions = (node: LGraphNode): MenuOption[] => {
    const hasImages = !!node?.imgs?.length
    const canPaste = canPasteImage(node)
    if (!hasImages && !canPaste) return []

    const options: MenuOption[] = []

    if (hasImages) {
      options.push(
        {
          label: t('contextMenu.Open in Mask Editor'),
          action: () => openMaskEditorForNode(node)
        },
        {
          label: t('contextMenu.Open Image'),
          icon: 'icon-[lucide--external-link]',
          action: () => openImage(node)
        },
        {
          label: t('contextMenu.Copy Image'),
          icon: 'icon-[lucide--copy]',
          action: () => copyImage(node)
        }
      )
    }

    if (canPaste) {
      options.push({
        label: t('contextMenu.Paste Image'),
        icon: 'icon-[lucide--clipboard-paste]',
        action: () => pasteClipboardImageToNode(node)
      })
    }

    if (hasImages) {
      options.push({
        label: t('contextMenu.Save Image'),
        icon: 'icon-[lucide--download]',
        action: () => saveImage(node)
      })
    }

    return options
  }

  return {
    getImageMenuOptions
  }
}
