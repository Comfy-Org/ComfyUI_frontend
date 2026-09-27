import displayJson from '../content/workshop-display.json'
import { workshopDisplayEntriesSchema } from '../content/workshop-display.schema'
import { workflowCatalog } from './workshop-workflow-catalog'
import { workflowPagesFor } from './workshop-workflow-pages'

export { workflowPagesFor } from './workshop-workflow-pages'

const pages = workflowPagesFor(
  workshopDisplayEntriesSchema.parse(displayJson),
  workflowCatalog
)

export const workflowModels = pages.map(({ model }) => model)
export const workflowDetailsBySlug = new Map(
  pages.map(({ detail }) => [detail.slug, detail])
)
