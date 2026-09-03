import type { NodeExecutionOutput } from '@/schemas/apiSchema'

export function isInputPreviewOutput(
  output: Pick<NodeExecutionOutput, 'images'> | undefined
): boolean {
  const images = output?.images
  return (
    Array.isArray(images) &&
    images.length > 0 &&
    images.every((image) => image?.type === 'input')
  )
}
