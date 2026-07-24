import type {
  TemplateOpenTrigger,
  WorkflowImportMetadata,
  WorkflowOpenSource
} from '../types'
import { isTemplateOpenTrigger } from './templateOpenTrigger'

type TemplateAttribution = Partial<
  Pick<WorkflowImportMetadata, 'template_id' | 'open_trigger'>
>

/**
 * Per-template attribution for a workflow-open event; empty for any other open,
 * so their payload is unchanged. Re-validates the trigger so a shared URL can't
 * smuggle an unchecked value into telemetry.
 */
export function templateAttribution(
  openSource: WorkflowOpenSource | undefined,
  templateId: string | undefined,
  openTrigger: TemplateOpenTrigger | undefined
): TemplateAttribution {
  if (openSource !== 'template' || !templateId) return {}
  if (!isTemplateOpenTrigger(openTrigger)) return {}
  return { template_id: templateId, open_trigger: openTrigger }
}
