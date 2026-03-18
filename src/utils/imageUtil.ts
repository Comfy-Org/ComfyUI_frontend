/**
 * Parses an image widget value like "subfolder/filename [type]" into its parts.
 */
export function parseImageWidgetValue(raw: string): {
  filename: string
  subfolder: string
  type: string
} {
  let value = raw
  let type = 'input'
  const typeMatch = value.match(/ \[([^\]]+)\]$/)
  if (typeMatch) {
    type = typeMatch[1]
    value = value.slice(0, -typeMatch[0].length)
  }
  let subfolder = ''
  const slashIndex = value.lastIndexOf('/')
  if (slashIndex !== -1) {
    subfolder = value.slice(0, slashIndex)
    value = value.slice(slashIndex + 1)
  }
  return { filename: value, subfolder, type }
}

export const is_all_same_aspect_ratio = (imgs: HTMLImageElement[]): boolean => {
  if (!imgs.length || imgs.length === 1) return true

  const ratio = imgs[0].naturalWidth / imgs[0].naturalHeight

  for (let i = 1; i < imgs.length; i++) {
    const this_ratio = imgs[i].naturalWidth / imgs[i].naturalHeight
    if (ratio != this_ratio) return false
  }

  return true
}

export const fitDimensionsToNodeWidth = (
  width: number,
  height: number,
  nodeWidth: number,
  minHeight: number = 64
): { minHeight: number; minWidth: number } => {
  const intrinsicAspectRatio = width / height
  if (!intrinsicAspectRatio || isNaN(intrinsicAspectRatio))
    return { minHeight: 0, minWidth: 0 }

  // Set min. height s.t. image spans node's x-axis while maintaining aspect ratio
  const minWidth = nodeWidth
  const calculatedHeight = Math.max(minWidth / intrinsicAspectRatio, minHeight)

  return { minHeight: calculatedHeight, minWidth }
}
