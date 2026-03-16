import { useI18n } from 'vue-i18n'

import { downloadFile, openFileInNewTab } from '@/base/common/downloadUtil'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useCommandStore } from '@/stores/commandStore'

import type { MenuOption } from './useMoreOptionsMenu'

function canPasteImage(node: LGraphNode): boolean {
  return typeof node.pasteFiles === 'function'
}

/**
 * Composable for image-related menu operations
 */
export function useImageMenuOptions() {
  const { t } = useI18n()

  const openMaskEditor = () => {
    const commandStore = useCommandStore()
    void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
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

  const pasteImage = async (node: LGraphNode) => {
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
        const file = new File([blob], 'pasted-image.png', { type: imageType })
        node.pasteFiles?.([file])
        return
      }
    } catch (error) {
      console.error('Failed to paste image from clipboard:', error)
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
    if (!node?.imgs?.length) return []

    return [
      {
        label: t('contextMenu.Open in Mask Editor'),
        action: () => openMaskEditor()
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
      },
      ...(canPasteImage(node)
        ? [
            {
              label: t('contextMenu.Paste Image'),
              icon: 'icon-[lucide--clipboard-paste]',
              action: () => pasteImage(node)
            }
          ]
        : []),
      {
        label: t('contextMenu.Save Image'),
        icon: 'icon-[lucide--download]',
        action: () => saveImage(node)
      }
    ]
  }

  return {
    getImageMenuOptions
  }
}
