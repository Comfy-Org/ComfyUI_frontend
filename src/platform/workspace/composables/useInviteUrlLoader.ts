import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

import { usePreservedQueryDeepLink } from '@/platform/navigation/composables/usePreservedQueryDeepLink'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

/**
 * Composable for loading workspace invites from URL query parameters
 *
 * Supports URLs like:
 * - /?invite=TOKEN (accepts workspace invite)
 *
 * The invite token is preserved through login redirects via the
 * preserved query system (sessionStorage), following the same pattern
 * as the template URL loader.
 */
export function useInviteUrlLoader() {
  const { t } = useI18n()
  const toast = useToast()
  const workspaceStore = useTeamWorkspaceStore()
  const INVITE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.INVITE
  const deepLink = usePreservedQueryDeepLink(INVITE_NAMESPACE)

  /**
   * Loads and accepts workspace invite from URL query parameters if present.
   * Handles errors internally and shows appropriate user feedback.
   *
   * Flow:
   * 1. Restore preserved query (for post-login redirect)
   * 2. Check for invite token in route.query
   * 3. Accept the invite via API (backend validates token)
   * 4. Show toast notification
   * 5. Clean up URL and preserved query
   */
  const loadInviteFromUrl = async () => {
    const inviteParam = await deepLink.hydrateAndRead()
    if (!inviteParam || typeof inviteParam !== 'string') {
      return
    }

    try {
      const result = await workspaceStore.acceptInvite(inviteParam)

      toast.add({
        severity: 'success',
        summary: t('workspace.inviteAccepted'),
        detail: {
          text: t(
            'workspace.addedToWorkspace',
            { workspaceName: result.workspaceName },
            { escapeParameter: false }
          ),
          workspaceName: result.workspaceName,
          workspaceId: result.workspaceId
        },
        group: 'invite-accepted',
        closable: true
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('workspace.inviteFailed'),
        detail: error instanceof Error ? error.message : t('g.unknownError')
      })
    } finally {
      deepLink.strip()
    }
  }

  return {
    loadInviteFromUrl
  }
}
