import type { WidgetState } from '@comfyorg/graph-model/widgetState'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

/** Returns whether a live widget value belongs in the semantic document. */
export function isReplicatedValueWidget(
  widget: IBaseWidget | undefined,
  stored?: WidgetState
): boolean {
  if (!widget && !stored) return false
  const type = widget?.type ?? stored?.type
  const workflowSerialize = widget?.serialize ?? stored?.serialize
  const liveOptions = (
    widget as { options?: { serialize?: boolean } } | undefined
  )?.options
  const storedOptions = (
    stored as { options?: { serialize?: boolean } } | undefined
  )?.options
  const promptSerialize = liveOptions?.serialize ?? storedOptions?.serialize
  return (
    type !== 'button' &&
    (workflowSerialize !== false || promptSerialize !== false)
  )
}
