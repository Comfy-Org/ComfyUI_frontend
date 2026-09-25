import { boundWorkspaceId } from '@/entry/workspaceBinding'
import { useBillingWebSession } from '@/session/billingWebSession'

/**
 * The workspace a link leaving this app names: the one the session's
 * credential was minted for, which is what billing acted on. Before a mint
 * there is only the entry's binding, and an unbound tab names none.
 */
export function useBilledWorkspace(): () => string | undefined {
  const { session } = useBillingWebSession()
  return () => session.value?.workspace.id ?? boundWorkspaceId()
}
