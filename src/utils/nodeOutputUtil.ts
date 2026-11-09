import type {
  NodeExecutionOutput,
  ResultItem
} from '@comfyorg/api-client/executionTypes'

type InputPreviewOutput = Pick<NodeExecutionOutput, 'images'> & {
  images: ResultItem[]
}

export function isInputPreviewOutput(
  output: Pick<NodeExecutionOutput, 'images'> | undefined
): output is InputPreviewOutput {
  const images = output?.images
  return (
    Array.isArray(images) &&
    images.length > 0 &&
    images.every((image) => image.type === 'input')
  )
}
