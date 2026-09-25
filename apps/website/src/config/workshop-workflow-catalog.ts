import workflowsJsonl from '../content/workshop-workflows.jsonl?raw'
import { parseWorkflowCatalog } from './workshop-workflow-catalog-schema'

export { parseWorkflowCatalog } from './workshop-workflow-catalog-schema'
export type { WorkshopWorkflowEntry } from './workshop-workflow-catalog-schema'

export const workflowCatalog = parseWorkflowCatalog(workflowsJsonl)
