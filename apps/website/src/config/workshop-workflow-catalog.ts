import workflowsJsonl from '../content/workshop-workflows.jsonl?raw'
import {
  parseAppCatalog,
  parseWorkflowCatalog
} from './workshop-workflow-catalog-schema'

export { parseWorkflowCatalog } from './workshop-workflow-catalog-schema'
export type {
  WorkshopAppEntry,
  WorkshopWorkflowEntry
} from './workshop-workflow-catalog-schema'

export const workflowCatalog = parseWorkflowCatalog(workflowsJsonl)
export const appCatalog = parseAppCatalog(workflowsJsonl)
