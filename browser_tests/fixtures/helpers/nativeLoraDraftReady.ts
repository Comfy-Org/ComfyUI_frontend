import type {
  ActivePathPointer,
  DraftPayloadV2
} from '@/platform/workflow/persistence/base/draftTypes'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

export const nativeLoraDraftReady = ({
  path,
  draftKey,
  expected
}: {
  path: string
  draftKey: string
  expected: ComfyWorkflowJSON
}) => {
  type WidgetStateGraph = {
    nodes?: readonly {
      id?: unknown
      widgets_values?: unknown
    }[]
    definitions?: {
      subgraphs?: readonly (WidgetStateGraph & { id?: unknown })[]
    }
  }
  const widgetState = (graph: WidgetStateGraph): unknown => ({
    nodes:
      graph.nodes
        ?.toSorted((a, b) => String(a.id).localeCompare(String(b.id)))
        .map(({ id, widgets_values }) => ({
          id,
          widgets_values
        })) ?? [],
    subgraphs:
      graph.definitions?.subgraphs
        ?.toSorted((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((definition) => ({
          id: definition.id,
          widgets: widgetState(definition)
        })) ?? []
  })

  try {
    const clientId = window.app!.api.clientId ?? window.app!.api.initialClientId
    const pointer: ActivePathPointer | null = JSON.parse(
      sessionStorage.getItem(`Comfy.Workflow.ActivePath:${clientId}`)!
    )
    if (pointer?.path !== path) return false
    const payload: DraftPayloadV2 | null = JSON.parse(
      localStorage.getItem(
        `Comfy.Workflow.Draft.v2:${pointer.workspaceId}:${draftKey}`
      )!
    )
    if (typeof payload?.data !== 'string') return false
    const persisted: ComfyWorkflowJSON | null = JSON.parse(payload.data)
    if (!persisted || !Array.isArray(persisted.nodes)) return false
    return (
      JSON.stringify(widgetState(persisted)) ===
      JSON.stringify(widgetState(expected))
    )
  } catch {
    return false
  }
}
