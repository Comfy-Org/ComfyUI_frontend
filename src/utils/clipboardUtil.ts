import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

export async function pasteClipboardImageToNode(
  node: LGraphNode
): Promise<void> {
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
