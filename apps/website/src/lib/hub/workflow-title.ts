import { curatedWorkflowTitle } from '../../config/workflow-titles'
import { launchOutcome } from '../../config/workshop-launch'
import type { HubTemplate } from './types'

/**
 * The one name a workflow goes by, so the card a reader clicks and the page it
 * opens agree.
 *
 * The launch spec's outcome wins: it names the job the visitor came for, and
 * the workflow behind it is how that job is served. Then a name somebody wrote
 * by hand. Otherwise the registry's own words stand.
 */
export function workflowDisplayTitle(template: HubTemplate): string {
  return (
    launchOutcome(template.name) ??
    curatedWorkflowTitle(template.name) ??
    template.title.trim()
  )
}
