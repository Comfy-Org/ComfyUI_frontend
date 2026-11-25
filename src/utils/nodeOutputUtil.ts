import type {
  NodeExecutionOutput,
  ResultItem
} from '@comfyorg/graph-model/nodeOutput'

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

/** Merges an incremental `executed` output into a prior one, concatenating fields that are arrays on both sides. */
export function mergeNodeOutput(
  existing: NodeExecutionOutput,
  incoming: NodeExecutionOutput
): NodeExecutionOutput {
  const merged = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    const prior = existing[key]
    merged[key] =
      Array.isArray(prior) && Array.isArray(value) ? prior.concat(value) : value
  }
  return merged
}
