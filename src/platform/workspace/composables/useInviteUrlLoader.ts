import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

import { useWorkspaceStore } from '../stores/workspaceStore'

const LOG_PREFIX = '[useInviteUrlLoader]'

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
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toast = useToast()
  const workspaceStore = useWorkspaceStore()
  const INVITE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.INVITE

  /**
   * Hydrates preserved query from sessionStorage and merges into route.
   * This restores the invite token after login redirects.
   */
  const ensureInviteQueryFromIntent = async () => {
    hydratePreservedQuery(INVITE_NAMESPACE)
    const mergedQuery = mergePreservedQueryIntoQuery(
      INVITE_NAMESPACE,
      route.query
    )

    if (mergedQuery) {
      await router.replace({ query: mergedQuery })
    }

    return mergedQuery ?? route.query
  }

  /**
   * Removes invite parameter from URL using Vue Router
   */
  const cleanupUrlParams = () => {
    const newQuery = { ...route.query }
    delete newQuery.invite
    void router.replace({ query: newQuery })
  }

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
    console.log(LOG_PREFIX, 'Starting invite URL loading')
    console.log(LOG_PREFIX, 'Current route.query:', route.query)

    // Restore preserved query from sessionStorage (handles login redirect case)
    const query = await ensureInviteQueryFromIntent()
    console.log(LOG_PREFIX, 'Query after hydration:', query)

    const inviteParam = query.invite
    console.log(
      LOG_PREFIX,
      'Invite param:',
      inviteParam,
      'type:',
      typeof inviteParam
    )

    if (!inviteParam || typeof inviteParam !== 'string') {
      console.log(LOG_PREFIX, 'No valid invite param found, skipping')
      return
    }

    console.log(LOG_PREFIX, 'Accepting invite with token:', inviteParam)

    try {
      const result = await workspaceStore.acceptInvite(inviteParam)
      console.log(LOG_PREFIX, 'Invite accepted successfully:', result)

      toast.add({
        severity: 'success',
        summary: t('workspace.inviteAccepted'),
        detail: t('workspace.addedToWorkspace', {
          workspaceName: result.workspaceName
        }),
        life: 5000
      })
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to accept invite:', error)
      toast.add({
        severity: 'error',
        summary: t('workspace.inviteFailed'),
        detail: error instanceof Error ? error.message : t('g.unknownError'),
        life: 5000
      })
    } finally {
      cleanupUrlParams()
      clearPreservedQuery(INVITE_NAMESPACE)
    }
  }

  return {
    loadInviteFromUrl
  }
}
