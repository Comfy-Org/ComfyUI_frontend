// Server/build-time only: do not import the bundled contract catalogue in a Vue island.
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { workshopContract } from '../../../config/workshop-contract-catalog'
import { formForContract } from '../../../config/workshop-contract'
import { ENHANCEMENT_ROUTER_ID } from './enhancement'

/** An internal Studio integration, not a published /models catalogue entry. */
export function cinematicEnhancementModel(): WorkshopModelDetail | undefined {
  const execution = workshopContract(ENHANCEMENT_ROUTER_ID)
  if (!execution) return
  return {
    slug: `cinematic-enhancer--${execution.id.replaceAll('/', '--')}`,
    routerId: execution.id,
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    href: '',
    workflowCount: 0,
    modality: 'text',
    modalities: ['text'],
    capabilities: [],
    fields: [],
    defaults: {},
    examples: [],
    execution,
    form: formForContract(execution)
  }
}
