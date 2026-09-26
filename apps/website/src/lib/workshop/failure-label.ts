import type { RunFailure } from '../../config/workshop-run'
import type { TranslationKey } from '../../i18n/translations'

export const failureLabelKey: Record<RunFailure, TranslationKey> = {
  validation: 'workshop.error.validation',
  provider: 'workshop.error.provider',
  upload: 'workshop.error.upload',
  network: 'workshop.error.network',
  response: 'workshop.error.response',
  client: 'workshop.error.client',
  concurrency: 'workshop.error.concurrency',
  conflict: 'workshop.error.conflict',
  rateLimit: 'workshop.error.rateLimit',
  policy: 'workshop.error.policy',
  noCredits: 'workshop.error.noCredits',
  unavailable: 'workshop.error.unavailable',
  timeout: 'workshop.error.timeout'
}
