<template>
  <slot v-if="initializationState === 'ready'" />
  <div
    v-else-if="initializationState !== 'initializing'"
    ref="errorPanel"
    class="flex size-full items-center justify-center bg-base-background p-8"
    role="alert"
    tabindex="-1"
  >
    <div class="flex max-w-md flex-col items-center gap-4 text-center">
      <i
        aria-hidden="true"
        class="icon-[lucide--triangle-alert] size-8 text-error"
      />
      <div>
        <h1 class="m-0 text-lg font-semibold text-base-foreground">
          {{ $t('workspaceAuth.initializationFailed') }}
        </h1>
        <p class="mt-2 mb-0 text-muted-foreground">
          {{
            $t(
              initializationRetryable
                ? 'workspaceAuth.initializationFailedDetail'
                : 'workspaceAuth.initializationFailedSignOutDetail'
            )
          }}
        </p>
      </div>
      <Button
        v-if="initializationRetryable"
        :aria-busy="initializationState === 'retrying'"
        :disabled="initializationState === 'retrying'"
        @click="retryInitialization"
      >
        {{ $t('workspaceAuth.retry') }}
      </Button>
      <Button variant="secondary" @click="handleSignOut">
        {{ $t('auth.signOut.signOut') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WorkspaceAuthGate - Cloud workspace auth checkpoint.
 *
 * This gate ensures proper initialization order for workspace-scoped auth:
 * 1. Wait for Firebase auth to resolve
 * 2. Load authenticated remote configuration
 * 3. Initialize the workspace token and store before rendering
 *
 * This prevents race conditions where API calls use Firebase tokens
 * instead of workspace tokens.
 *
 * The splash loader in index.html (z-9999) covers the screen during this
 * phase, so no separate loading indicator is needed here.
 */
import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import {
  remoteConfigErrorStatus,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const FIREBASE_INIT_TIMEOUT_MS = 16_000
const CONFIG_REFRESH_TIMEOUT_MS = 10_000

const initializationState = ref<
  'initializing' | 'retrying' | 'ready' | 'error'
>(isCloud ? 'initializing' : 'ready')
const initializationRetryable = ref(true)
const errorPanel = useTemplateRef<HTMLElement>('errorPanel')
const billingCapabilities = useBillingCapabilities()
let initializationGeneration = 0
let initializationController: AbortController | null = null
let backgroundInitialization: Promise<void> | null = null
let backgroundInitializationUserId: string | null | undefined

function cancelInitialization(): void {
  initializationGeneration++
  initializationController?.abort()
  initializationController = null
  backgroundInitialization = null
  backgroundInitializationUserId = undefined
}

async function initialize(): Promise<void> {
  if (!isCloud) {
    void initializeWorkspacesInBackground()
    return
  }

  cancelInitialization()
  const generation = initializationGeneration
  const controller = new AbortController()
  initializationController = controller

  const authStore = useAuthStore()
  const { isInitialized, currentUser } = storeToRefs(authStore)

  try {
    // Step 1: Wait for Firebase auth to resolve
    // This is shared with router guard - both wait for the same thing,
    // but this gate blocks rendering while router guard blocks navigation
    if (!isInitialized.value) {
      await until(isInitialized).toBe(true, {
        timeout: FIREBASE_INIT_TIMEOUT_MS,
        throwOnTimeout: true
      })
    }
    if (generation !== initializationGeneration) return

    // Step 2: If not authenticated, nothing more to do
    // Unauthenticated users don't have workspace context
    if (!currentUser.value) {
      initializationState.value = 'ready'
      return
    }

    // Step 3: Refresh feature flags with auth context
    // Timeout prevents hanging if server is slow/unresponsive
    let timeoutId: ReturnType<typeof setTimeout>
    await Promise.race([
      refreshRemoteConfig({ useAuth: true, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error('Config refresh timeout'))
        }, CONFIG_REFRESH_TIMEOUT_MS)
      })
    ]).finally(() => clearTimeout(timeoutId))
    if (generation !== initializationGeneration) return
    if (remoteConfigState.value !== 'authenticated') {
      throw new Error('Failed to load authenticated remote config')
    }

    const { flags } = useFeatureFlags()
    const workspaceAuthStore = useWorkspaceAuthStore()
    if (flags.unifiedCloudAuthEnabled) {
      const authenticated = await workspaceAuthStore.mintAtLogin()
      if (generation !== initializationGeneration) return
      if (!authenticated) {
        throw new Error('Failed to initialize unified cloud auth')
      }
    }

    await initializeWorkspaceMode()
    if (generation !== initializationGeneration) return
    void billingCapabilities.initialize(controller.signal)
    if (
      flags.unifiedCloudAuthEnabled &&
      !workspaceAuthStore.getUnifiedToken()
    ) {
      throw new Error('Unified cloud auth was cleared during workspace setup')
    }

    if (generation === initializationGeneration) {
      initializationState.value = 'ready'
    }
  } catch (error) {
    if (generation !== initializationGeneration) return
    console.error('[WorkspaceAuthGate] Initialization failed:', error)
    reportError(error, {
      errorType: 'workspace_auth_gate_initialization_failure'
    })
    initializationRetryable.value = isRetryableInitializationError(error)
    initializationState.value = 'error'
    document.getElementById('splash-loader')?.remove()
    await nextTick()
    if (generation !== initializationGeneration) return
    errorPanel.value?.focus()
  }
}

function isRetryableInitializationError(error: unknown): boolean {
  if (
    remoteConfigErrorStatus.value === 401 ||
    remoteConfigErrorStatus.value === 403
  ) {
    return false
  }
  return !(
    error instanceof Error && error.message === 'No workspaces available'
  )
}

async function retryInitialization(): Promise<void> {
  initializationState.value = 'retrying'
  await initialize()
}

async function handleSignOut(): Promise<void> {
  cancelInitialization()
  await useAuthActions().logout()
}

async function initializeWorkspaceMode(): Promise<void> {
  // Initialize the full workspace store which handles:
  // - Restoring workspace token from session (fast path for refresh)
  // - Fetching workspace list
  // - Switching to last used workspace if needed
  // - Setting active workspace
  const workspaceStore = useTeamWorkspaceStore()
  if (
    workspaceStore.initState === 'uninitialized' ||
    workspaceStore.initState === 'error'
  ) {
    await workspaceStore.initialize()
  }
  if (
    workspaceStore.initState !== 'ready' ||
    !workspaceStore.activeWorkspaceId
  ) {
    throw new Error('Failed to initialize workspace context')
  }
}

// The local session identity: the Firebase uid, or the validated API key for
// key-only sessions. Workspace initialization keys off this so an API-key
// login boots workspace context the same way a Firebase login does.
function localSessionIdentity(): string | null {
  const { currentUser } = storeToRefs(useAuthStore())
  if (currentUser.value?.uid) return currentUser.value.uid
  const apiKeyStore = useApiKeyAuthStore()
  return apiKeyStore.isAuthenticated ? apiKeyStore.getApiKey() : null
}

function initializeWorkspacesInBackground(): Promise<void> {
  const { isInitialized } = storeToRefs(useAuthStore())
  const sessionId = localSessionIdentity()
  if (
    backgroundInitialization &&
    backgroundInitializationUserId === sessionId
  ) {
    return backgroundInitialization
  }

  cancelInitialization()
  const generation = initializationGeneration
  backgroundInitializationUserId = sessionId

  const operation = (async () => {
    if (!isInitialized.value) {
      await until(isInitialized).toBe(true, {
        timeout: FIREBASE_INIT_TIMEOUT_MS,
        throwOnTimeout: true
      })
    }
    if (
      sessionId === null ||
      generation !== initializationGeneration ||
      localSessionIdentity() !== sessionId
    ) {
      return
    }
    await initializeWorkspaceMode()
  })().catch((error: unknown) => {
    if (generation === initializationGeneration) {
      console.warn(
        '[WorkspaceAuthGate] Background workspace initialization failed:',
        error
      )
    }
  })

  backgroundInitialization = operation
  void operation.finally(() => {
    if (backgroundInitialization === operation) {
      backgroundInitialization = null
      backgroundInitializationUserId = undefined
    }
  })
  return operation
}

// Initialize on mount. This gate should be placed on the authenticated layout
// (LayoutDefault) so it mounts fresh after login and unmounts on logout.
// The router guard ensures only authenticated users reach this layout.
onMounted(() => {
  void initialize()
})

if (!isCloud) {
  const sessionIdentity = computed(() => localSessionIdentity())
  watch(sessionIdentity, (identity, previousIdentity) => {
    if (previousIdentity !== null && identity !== previousIdentity) {
      useTeamWorkspaceStore().resetForIdentityChange()
    }
    if (identity) {
      void initializeWorkspacesInBackground()
    } else {
      cancelInitialization()
    }
  })
}
onUnmounted(cancelInitialization)
</script>
