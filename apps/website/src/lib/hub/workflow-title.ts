import { curatedWorkflowTitle } from '../../config/workflow-titles'
import type { HubTemplate } from './types'

/**
 * The one name a workflow goes by, so the card a reader clicks and the page it
 * opens agree.
 *
 * A name somebody wrote wins. Otherwise the registry's own words stand: they
 * lead with the model, which is what separates one card from the next inside a
 * row that has already named the job.
 */
export function workflowDisplayTitle(template: HubTemplate): string {
  return curatedWorkflowTitle(template.name) ?? template.title.trim()
}
