import type { NodeExecutionOutput } from '@/schemas/apiSchema'

export function isInputPreviewOutput(
  output: Pick<NodeExecutionOutput, 'images'> | undefined
): boolean {
  return Boolean(
    output?.images?.length &&
    output.images.every((image) => image?.type === 'input')
  )
}
