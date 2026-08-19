import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

export type WorkflowViewState = NonNullable<
  NonNullable<ComfyWorkflowJSON['extra']>['ds']
>

type ViewStateSource = {
  scale: number
  offset: readonly [number, number]
}

export function getValidWorkflowViewState(
  value: unknown
): WorkflowViewState | null {
  if (typeof value !== 'object' || value === null) return null

  const viewState = value as Record<string, unknown>
  const { scale, offset } = viewState
  if (
    typeof scale !== 'number' ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Array.isArray(offset) ||
    offset.length < 2 ||
    typeof offset[0] !== 'number' ||
    !Number.isFinite(offset[0]) ||
    typeof offset[1] !== 'number' ||
    !Number.isFinite(offset[1])
  ) {
    return null
  }

  return { scale, offset: [offset[0], offset[1]] }
}

export function withWorkflowViewState(
  workflow: ComfyWorkflowJSON,
  viewState: ViewStateSource | undefined,
  enabled: boolean
): ComfyWorkflowJSON {
  if (!enabled || !viewState) return workflow

  return {
    ...workflow,
    extra: {
      ...workflow.extra,
      ds: {
        scale: viewState.scale,
        offset: [viewState.offset[0], viewState.offset[1]]
      }
    }
  }
}

export function workflowViewStateEqual(a: unknown, b: unknown): boolean {
  const left = getValidWorkflowViewState(a)
  const right = getValidWorkflowViewState(b)

  if (!left || !right) return left === right
  return (
    left.scale === right.scale &&
    left.offset[0] === right.offset[0] &&
    left.offset[1] === right.offset[1]
  )
}
