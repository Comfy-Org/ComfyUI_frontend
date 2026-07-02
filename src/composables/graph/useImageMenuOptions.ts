import { useI18n } from 'vue-i18n'

import { downloadFile, openFileInNewTab } from '@/base/common/downloadUtil'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCommandStore } from '@/stores/commandStore'

import type { MenuOption } from './useMoreOptionsMenu'

function canPasteImage(node?: LGraphNode): boolean {
  return typeof node?.pasteFiles === 'function'
}

/**
 * Resolve the full-resolution source URL of a node's currently shown image.
 *
 * Strips the `preview` query param so callers get the original asset rather than
 * the downscaled canvas preview. Returns null when the node has no image.
 * Shared by every image action (open / save / copy) so URL derivation stays in
 * one place.
 */
function getNodeImageUrl(node: LGraphNode): string | null {
  const img = node?.imgs?.[node.imageIndex ?? 0]
  if (!img) return null
  const url = new URL(img.src)
  url.searchParams.delete('preview')
  return url.toString()
}

/**
 * Fetch an image URL and return it as a PNG blob ready for the clipboard.
 *
 * Re-fetching the URL (instead of exporting the node's rendered <img> through a
 * canvas) is what avoids the tainted-canvas SecurityError for cross-origin cloud
 * assets: the fetched blob is always readable, whereas a canvas drawn from a
 * non-CORS cross-origin image cannot be exported.
 *
 * The blob is re-encoded to PNG when the source is not already PNG, because the
 * async clipboard only reliably accepts `image/png`. The bitmap is decoded from
 * a same-origin blob, so this canvas is never tainted.
 */
async function fetchImageAsPngBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const blob = await response.blob()
  if (blob.type === 'image/png') return blob

  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D canvas context')
    ctx.drawImage(bitmap, 0, 0)

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    if (!pngBlob) throw new Error('Failed to encode image as PNG')
    return pngBlob
  } finally {
    bitmap.close()
  }
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

  const openMaskEditor = () => {
    const commandStore = useCommandStore()
    void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
  }

  const openImage = (node: LGraphNode) => {
    const url = getNodeImageUrl(node)
    if (url) void openFileInNewTab(url)
  }

  const copyImage = async (node: LGraphNode) => {
    const url = getNodeImageUrl(node)
    if (!url) return

    try {
      if (!navigator.clipboard?.write) {
        throw new Error('Clipboard API not available')
      }
      // Pass a Promise to ClipboardItem so the write is registered
      // synchronously within the click's user-gesture, keeping activation
      // alive across the fetch (required by Safari, tolerated by Chrome).
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': fetchImageAsPngBlob(url) })
      ])
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error)
      useToastStore().addAlert(
        t('toastMessages.errorCopyImage', {
          error: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  const saveImage = (node: LGraphNode) => {
    const url = getNodeImageUrl(node)
    if (!url) return

    try {
      downloadFile(url)
    } catch (error) {
      console.error('Failed to save image:', error)
      useToastStore().addAlert(
        t('toastMessages.errorSaveImage', {
          error: error instanceof Error ? error.message : String(error)
        })
      )
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
          label: t('contextMenu.Open Image'),
          icon: 'icon-[lucide--external-link]',
          action: () => openImage(node)
        },
        {
          label: t('contextMenu.Open in Mask Editor'),
          icon: 'icon-[comfy--mask]',
          action: () => openMaskEditor()
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
