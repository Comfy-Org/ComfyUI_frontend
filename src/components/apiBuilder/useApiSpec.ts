import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ApiSpec, MediaKind, ParameterSource } from './apiSpec'
import { buildApiSpec, deriveWorkflowId } from './apiSpec'

export function useApiSpec(): ComputedRef<ApiSpec> {
  const workflowStore = useWorkflowStore()
  const appModeStore = useAppModeStore()
  const nodeDefStore = useNodeDefStore()
  const resolvedInputs = useResolvedSelectedInputs()

  function mediaKindForWidget(
    node: LGraphNode,
    widgetName: string
  ): MediaKind | undefined {
    const spec = nodeDefStore.getInputSpecForWidget(node, widgetName)
    if (!spec) return undefined
    if (
      ('image_upload' in spec && spec.image_upload) ||
      ('animated_image_upload' in spec && spec.animated_image_upload)
    ) {
      return 'image'
    }
    if ('video_upload' in spec && spec.video_upload) return 'video'
    if ('audio_upload' in spec && spec.audio_upload) return 'audio'
    if ('mesh_upload' in spec && spec.mesh_upload) return 'mesh'
    return undefined
  }

  return computed(() => {
    const parameters = resolvedInputs.value.flatMap(
      (entry): ParameterSource[] => {
        if (entry.status !== 'resolved') return []
        const { widget, node, displayName } = entry
        return [
          {
            displayName: widget.label ?? displayName,
            nodeTitle: node.title,
            widgetType: widget.type,
            value: widget.value,
            mediaKind: mediaKindForWidget(node, widget.name),
            options: {
              min: widget.options?.min,
              max: widget.options?.max,
              precision: widget.options?.precision,
              values: widget.options?.values
            }
          }
        ]
      }
    )

    const outputs = appModeStore.selectedOutputs.map((nodeId) => ({
      nodeId: String(nodeId),
      title: app.rootGraph?.getNodeById(nodeId)?.title ?? String(nodeId)
    }))

    const workflow = workflowStore.activeWorkflow
    return buildApiSpec({
      title: workflow?.filename ?? 'workflow',
      workflowId: deriveWorkflowId(workflow?.path ?? 'workflow'),
      parameters,
      outputs
    })
  })
}
