import type {
  NodeExecutionOutput,
  ResultItem
} from '@/platform/remote/comfyui/execution/types'

type InputPreviewOutput = Pick<NodeExecutionOutput, 'images'> & {
  images: ResultItem[]
}

export function isInputPreviewOutput(
  output: unknown
): output is InputPreviewOutput {
  if (typeof output !== 'object' || output === null || !('images' in output)) {
    return false
  }

  const images = output.images
  return (
    Array.isArray(images) &&
    images.length > 0 &&
    images.every(
      (image) =>
        typeof image === 'object' &&
        image !== null &&
        'type' in image &&
        image.type === 'input'
    )
  )
}
