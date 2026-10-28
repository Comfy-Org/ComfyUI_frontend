import { createPartnerNodeTokenSource } from '@/platform/auth/partnerNode/partnerNodeTokenSource'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'

export const partnerNodeTokens = createPartnerNodeTokenSource({
  apiUrl: ingestApiUrl
})
