import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'
import type { HubTemplate } from './types'

export type FacetedTemplate = HubTemplate & {
  readonly partner?: string
  readonly useCase?: UseCase
}

export function withFacetFields(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): FacetedTemplate {
  return {
    ...template,
    // Ten registry titles carry a stray leading or trailing space, which reads
    // as a blank first character and sorts ahead of every digit and letter.
    title: template.title.trim(),
    partner: partnerModelFor(template, models)?.provider,
    // Resolved once per workflow rather than per read: the use-case rail asks
    // every tab for its tally, so deriving it on read rescans all 139 models
    // once per workflow per tab.
    useCase: useCaseForTemplate(template, models)
  }
}
