import { useToast } from '@/components/ui/toast/toastStore'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/utils/errorUtil'

import { WorkspaceApiError } from '../api/workspaceApi'
import { MEMBERSHIP_MANAGED_BY_DIRECTORY } from '../api/workspaceApiError'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'
import { useWorkspaceSwitch } from './useWorkspaceSwitch'

function isDirectoryManagedRefusal(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError &&
    error.status === 403 &&
    error.code === MEMBERSHIP_MANAGED_BY_DIRECTORY &&
    useFeatureFlags().flags.ssoEnabled
  )
}

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
  const { switchWorkspace } = useWorkspaceSwitch()
  const { showInviteLinkInvalidDialog, showInviteWrongAccountDialog } =
    useWorkspaceDialogs()
  const workspaceStore = useTeamWorkspaceStore()
  const authStore = useAuthStore()
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
    // Restore preserved query from sessionStorage (handles login redirect case)
    const query = await ensureInviteQueryFromIntent()
    const inviteParam = query.invite
    if (!inviteParam || typeof inviteParam !== 'string') {
      return
    }

    if (authStore.signedInWithSso && authStore.currentUser === null) {
      toast.info(t('workspace.inviteSsoUnavailable'), {
        description: t('workspace.inviteSsoUnavailableDetail')
      })
      cleanupUrlParams()
      clearPreservedQuery(INVITE_NAMESPACE)
      return
    }

    try {
      const result = await workspaceStore.acceptInvite(inviteParam)

      const inviteToastId = toast.success(t('workspace.inviteAccepted'), {
        description: t(
          'workspace.addedToNamedWorkspace',
          { workspaceName: result.workspaceName },
          { escapeParameter: false }
        ),
        action: {
          label: t('workspace.viewWorkspace'),
          onClick: async () => {
            if (await switchWorkspace(result.workspaceId)) {
              toast.dismiss(inviteToastId)
            } else {
              toast.error(t('workspace.switchFailed'), { duration: 5000 })
            }
          }
        }
      })
    } catch (error) {
      await presentAcceptFailure(error, inviteParam)
    } finally {
      // showDialog resolves immediately, so this clears the preserved token
      // while a landing dialog is still open — Switch account re-stashes it
      // itself before signing out.
      cleanupUrlParams()
      clearPreservedQuery(INVITE_NAMESPACE)
    }
  }

  /**
   * A parsed `code` marks a genuine API ErrorResponse; infra responses (WAF,
   * proxy, CDN) carry none and fall through to the toast. On this endpoint
   * each status has exactly one contract meaning: 404 covers expired /
   * revoked / rotated-by-resend alike (the BE cannot distinguish them), 403
   * is an email mismatch.
   */
  async function presentAcceptFailure(error: unknown, inviteToken: string) {
    const status =
      error instanceof WorkspaceApiError && error.code !== undefined
        ? error.status
        : undefined
    if (isDirectoryManagedRefusal(error)) {
      toast.info(t('workspace.inviteDirectoryManaged'), {
        description: t('workspace.inviteDirectoryManagedDetail')
      })
      return
    }
    try {
      if (status === 404) {
        await showInviteLinkInvalidDialog()
        return
      }
      if (status === 403) {
        await showInviteWrongAccountDialog({ inviteToken })
        return
      }
    } catch (dialogError) {
      reportError(dialogError, {
        errorType: 'error_showing_invite_landing_dialog',
        surface: 'workspace'
      })
    }
    reportError(error, {
      errorType: 'error_accepting_workspace_invite',
      surface: 'workspace'
    })
    toast.error(t('workspace.inviteFailed'), {
      description: getErrorMessage(error) ?? t('g.unknownError')
    })
  }

  return {
    loadInviteFromUrl
  }
}
