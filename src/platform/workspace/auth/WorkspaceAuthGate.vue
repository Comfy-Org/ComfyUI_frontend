<template>
  <slot v-if="isReady" />
</template>

<script setup lang="ts">
/**
 * WorkspaceAuthGate - Conditional auth checkpoint for workspace mode.
 *
 * This gate ensures proper initialization order for workspace-scoped auth:
 * 1. Wait for Firebase auth to resolve
 * 2. Check if teamWorkspacesEnabled feature flag is on
 * 3. If YES: Initialize workspace token and store before rendering
 * 4. If NO: Render immediately using existing Firebase auth
 *
 * This prevents race conditions where API calls use Firebase tokens
 * instead of workspace tokens when the workspace feature is enabled.
 *
 * The splash loader in index.html (z-9999) covers the screen during this
 * phase, so no separate loading indicator is needed here.
 */
import { captureException } from '@sentry/vue'
import { promiseTimeout, until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

const FIREBASE_INIT_TIMEOUT_MS = 16_000
const CONFIG_REFRESH_TIMEOUT_MS = 10_000

const isReady = ref(!isCloud)
const subscriptionDialog = useSubscriptionDialog()

async function initialize(): Promise<void> {
  if (!isCloud) return

  const authStore = useAuthStore()
  const { isInitialized, currentUser } = storeToRefs(authStore)

  try {
    // Step 1: Wait for Firebase auth to resolve
    // This is shared with router guard - both wait for the same thing,
    // but this gate blocks rendering while router guard blocks navigation
    if (!isInitialized.value) {
      await until(isInitialized).toBe(true, {
        timeout: FIREBASE_INIT_TIMEOUT_MS
      })
    }

    // Step 2: If not authenticated, nothing more to do
    // Unauthenticated users don't have workspace context
    if (!currentUser.value) {
      isReady.value = true
      return
    }

    // Step 3: Refresh feature flags with auth context
    // This ensures teamWorkspacesEnabled reflects the authenticated user's state
    // Timeout prevents hanging if server is slow/unresponsive
    await Promise.race([
      refreshRemoteConfig({ useAuth: true }),
      promiseTimeout(CONFIG_REFRESH_TIMEOUT_MS).then(() => {
        throw new Error('Config refresh timeout')
      })
    ])
    if (remoteConfigState.value !== 'authenticated') {
      throw new Error('Failed to load authenticated remote config')
    }

    // Step 4: THE CHECKPOINT - Are we in workspace mode?
    const { flags } = useFeatureFlags()
    const workspaceAuthStore = useWorkspaceAuthStore()
    if (flags.unifiedCloudAuthEnabled) {
      const authenticated = await workspaceAuthStore.mintAtLogin()
      if (!authenticated) {
        throw new Error('Failed to initialize unified cloud auth')
      }
    }

    if (!flags.teamWorkspacesEnabled) {
      // Not in workspace mode - use existing Firebase auth flow
      // No additional initialization needed
      isReady.value = true
      return
    }

    // Step 5: WORKSPACE MODE - Full initialization
    await initializeWorkspaceMode()
    if (
      flags.unifiedCloudAuthEnabled &&
      !workspaceAuthStore.getUnifiedToken()
    ) {
      throw new Error('Unified cloud auth was cleared during workspace setup')
    }

    // Step 6: Resume any pending pricing flow from team workspace creation
    // Only safe after workspace store initialized successfully — the pricing
    // dialog reads workspace state to decide which variant to show.
    const workspaceStore = useTeamWorkspaceStore()
    if (workspaceStore.initState === 'ready') {
      subscriptionDialog.resumePendingPricingFlow()
    }

    isReady.value = true
  } catch (error) {
    console.error('[WorkspaceAuthGate] Initialization failed:', error)
    captureException(error, {
      tags: {
        error_type: 'workspace_auth_gate_initialization_failure'
      }
    })
  }
}

async function initializeWorkspaceMode(): Promise<void> {
  // Initialize the full workspace store which handles:
  // - Restoring workspace token from session (fast path for refresh)
  // - Fetching workspace list
  // - Switching to last used workspace if needed
  // - Setting active workspace
  const workspaceStore = useTeamWorkspaceStore()
  if (workspaceStore.initState === 'uninitialized') {
    await workspaceStore.initialize()
  }
  if (
    workspaceStore.initState !== 'ready' ||
    !workspaceStore.activeWorkspaceId
  ) {
    throw new Error('Failed to initialize workspace context')
  }
}

// Initialize on mount. This gate should be placed on the authenticated layout
// (LayoutDefault) so it mounts fresh after login and unmounts on logout.
// The router guard ensures only authenticated users reach this layout.
onMounted(() => {
  void initialize()
})
</script>
