import type { AutoReloadSettings } from '@comfyorg/ingest-types'

/** The status the server served for the auto top-up card. */
export type AutoTopUpCardStatus = AutoReloadSettings['status']

/** The card showing a served status; reported again only when the status changes. */
export type AutoTopUpCardBillingEvent = {
  operation: 'auto_top_up_card'
  stage: 'viewed'
  outcome: 'pending'
  status: AutoTopUpCardStatus
}
