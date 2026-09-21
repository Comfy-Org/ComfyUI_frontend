import type { UseCase } from '../../config/models-catalogue'
import { curatedWorkflowTitle } from '../../config/workflow-titles'
import { t } from '../../i18n/translations'
import { useCaseLabelKey } from '../workshop/use-case-label'
import type { HubTemplate } from './types'

const plainName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * A registry title is written as "<model>: <operation>", which says which
 * model runs before it says what the workflow gets you, and sometimes says
 * only the model. Where the title leads with a model the workflow names, the
 * page puts the job first and keeps the model after it.
 *
 * A title that already leads with its job — "Video Upscale: SeedVR2 3B Int8"
 * — is left alone, which is the shape everything here is moving towards.
 */
function workflowJobTitle(
  template: HubTemplate,
  useCase: UseCase | undefined
): { readonly useCase: UseCase; readonly model: string } | undefined {
  if (!useCase) return undefined
  const lead = template.title.split(':')[0].trim()
  if (!lead) return undefined
  const namesTheModel = template.models.some(
    (model) => plainName(model) === plainName(lead)
  )
  return namesTheModel ? { useCase, model: lead } : undefined
}

/**
 * The one name a workflow goes by, so the card a reader clicks and the page it
 * opens agree. A name somebody wrote wins; failing that the job-first rewrite;
 * failing that the registry's own words.
 */
export function workflowDisplayTitle(
  template: HubTemplate,
  useCase: UseCase | undefined
): string {
  const curated = curatedWorkflowTitle(template.name)
  if (curated) return curated
  const job = workflowJobTitle(template, useCase)
  return job
    ? t('workshop.v2.workflow.jobTitle')
        .replace('{useCase}', t(useCaseLabelKey[job.useCase]))
        .replace('{model}', job.model)
    : template.title.trim()
}
