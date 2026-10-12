import { createPartnerNodeTokenSource } from '@/platform/auth/partnerNode/partnerNodeTokenSource'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'

export const partnerNodeTokens = createPartnerNodeTokenSource({
  apiUrl: workspaceApiUrl
})
