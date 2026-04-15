import { zHubWorkflowTemplateEntry } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

// The live cloud index response currently includes fields that are not yet
// present in the generated ingest OpenAPI types.
export const zHubWorkflowIndexEntry = zHubWorkflowTemplateEntry.extend({
  usage: z.number().optional(),
  searchRank: z.number().optional(),
  isEssential: z.boolean().optional(),
  useCase: z.string().optional(),
  license: z.string().optional(),
  // TODO(hub-api): Pending BE spec confirmation — field names may change.
  // These enable category nav grouping (e.g. section="Image", sectionGroup="GENERATION TYPE").
  section: z.string().optional(),
  sectionGroup: z.string().optional()
})

export const zHubWorkflowIndexResponse = z.array(zHubWorkflowIndexEntry)

export type HubWorkflowIndexEntry = z.infer<typeof zHubWorkflowIndexEntry>
