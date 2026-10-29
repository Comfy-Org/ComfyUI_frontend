import { createBillingApi } from '@comfyorg/billing-core'
import { useTelemetry } from '@comfyorg/telemetry'

import {
  ingestApiClient,
  requestAuth,
  handleAxiosError
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'

export const billingApi = createBillingApi({
  client: ingestApiClient,
  requestAuth,
  resolveUrl: ingestApiUrl,
  handleError: handleAxiosError,
  trackBillingEvent: (event) => useTelemetry()?.trackBillingEvent(event)
})
