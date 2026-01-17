import { useI18n } from 'vue-i18n'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useToastStore } from '@/platform/updates/common/toastStore'

type AcceptInviteFn = (
  token: string
) => Promise<{ workspaceId: string; workspaceName: string }>

/**
 * Composable for loading workspace invites from URL query parameters
 *
 * Supports URLs like:
 * - /?invite=TOKEN (accepts workspace invite)
 *
 * Input validation:
 * - Token parameter must be a non-empty string
 */
export function useInviteUrlLoader() {
  const { t } = useI18n()
  const toastStore = useToastStore()
  const INVITE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.INVITE

  /**
   * Gets the invite token from URL query parameters
   */
  function getInviteTokenFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    return token && token.trim().length > 0 ? token : null
  }

  /**
   * Removes the invite parameter from URL without triggering navigation
   */
  function clearInviteTokenFromUrl() {
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState(window.history.state, '', url.toString())
  }

  /**
   * Loads and accepts workspace invite from URL query parameters if present
   * Handles errors internally and shows appropriate user feedback
   */
  async function loadInviteFromUrl(acceptInvite: AcceptInviteFn) {
    const token = getInviteTokenFromUrl()

    if (!token) {
      return
    }

    try {
      const result = await acceptInvite(token)

      toastStore.add({
        severity: 'success',
        summary: t('workspace.inviteAccepted'),
        detail: t('workspace.addedToWorkspace', {
          workspaceName: result.workspaceName
        }),
        life: 5000
      })
    } catch (error) {
      console.error('[useInviteUrlLoader] Failed to accept invite:', error)
      toastStore.add({
        severity: 'error',
        summary: t('workspace.inviteFailed'),
        detail: t('g.error'),
        life: 5000
      })
    } finally {
      clearInviteTokenFromUrl()
      clearPreservedQuery(INVITE_NAMESPACE)
    }
  }

  return {
    getInviteTokenFromUrl,
    clearInviteTokenFromUrl,
    loadInviteFromUrl
  }
}
