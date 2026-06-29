import type {
  TemplateOpenTrigger,
  WorkflowImportMetadata,
  WorkflowOpenSource
} from '../types'

type TemplateAttribution = Partial<
  Pick<WorkflowImportMetadata, 'template_id' | 'open_trigger'>
>

/**
 * Per-template attribution for a workflow-open event. Empty unless the open
 * actually came from a template and both tags are present, so non-template
 * opens emit an unchanged payload.
 */
export function templateAttribution(
  openSource: WorkflowOpenSource | undefined,
  templateId: string | undefined,
  openTrigger: TemplateOpenTrigger | undefined
): TemplateAttribution {
  if (openSource !== 'template' || !templateId || !openTrigger) return {}
  return { template_id: templateId, open_trigger: openTrigger }
}
