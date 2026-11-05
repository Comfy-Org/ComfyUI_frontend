import { createBillingApi } from '@comfyorg/billing-core'
import {
  ingestApiClient,
  requestAuth,
  handleAxiosError
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'
import { useTelemetry } from '@comfyorg/telemetry'

export const billingApi = createBillingApi({
  client: ingestApiClient,
  requestAuth,
  resolveUrl: ingestApiUrl,
  handleError: handleAxiosError,
  trackBillingEvent: (event) => useTelemetry()?.trackBillingEvent(event)
})
