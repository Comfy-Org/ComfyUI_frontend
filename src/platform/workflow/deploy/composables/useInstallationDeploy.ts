import { computed, readonly, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { t } from '@/i18n'
import { isDesktop } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { createInstallationBundle } from '@/platform/workflow/deploy/api/installationBundleApi'
import type {
  BundleFailureReason,
  BundleResult
} from '@/platform/workflow/deploy/api/installationBundleApi'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

export type InstallationDeployState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'opened' }
  | { status: 'tab_blocked'; url: string }

type DeployFailure = {
  ok: false
  reason: BundleFailureReason | 'signed_out' | 'identity_changed'
  cause?: unknown
}

type TokenLookup =
  | { ok: true; token: string | undefined }
  | { ok: false; cause: unknown }

type CredentialLookup =
  | { ok: true; header: AuthHeader; owner: string | null }
  | DeployFailure

type OwnedBundleResult =
  | (BundleResult & { owner: string | null })
  | DeployFailure

type DeploymentState =
  | Exclude<InstallationDeployState, { status: 'tab_blocked' }>
  | { status: 'tab_blocked'; url: string; owner: string | null }

const FAILURE_MESSAGE_KEY = {
  unauthorized: 'deployToComfyApi.bundleUnauthorized',
  too_many_bundles: 'deployToComfyApi.bundleTooMany',
  too_large: 'deployToComfyApi.bundleTooLarge',
  offline: 'deployToComfyApi.bundleUnavailable',
  busy: 'deployToComfyApi.bundleBusy',
  unavailable: 'deployToComfyApi.bundleUnavailable',
  invalid_request: 'deployToComfyApi.bundleRejected'
} satisfies Record<BundleFailureReason, string>

const REPORTED_REASONS: ReadonlySet<BundleFailureReason> = new Set([
  'unavailable',
  'invalid_request'
])

const deployment = ref<DeploymentState>({ status: 'idle' })

function openInNewTab(url: string): boolean {
  const tab = window.open(url, '_blank')
  if (tab) tab.opener = null
  return tab !== null || isDesktop || window.__comfyDesktop2 !== undefined
}

export function useInstallationDeploy() {
  const authStore = useAuthStore()
  const apiKeyAuthStore = useApiKeyAuthStore()
  const { showSignInDialog } = useAuthDialogs()
  const toast = useToast()
  const state = computed<InstallationDeployState>(() => {
    const current = deployment.value
    if (current.status !== 'tab_blocked') return current
    return current.owner === authStore.currentUserIdentity()
      ? { status: 'tab_blocked', url: current.url }
      : { status: 'idle' }
  })

  async function workspaceToken(): Promise<TokenLookup> {
    try {
      return { ok: true, token: await authStore.getWorkspaceAuthToken() }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async function deployCredential(): Promise<CredentialLookup> {
    const owner = authStore.currentUserIdentity()
    const workspace = await workspaceToken()
    if (owner !== authStore.currentUserIdentity()) {
      return { ok: false, reason: 'identity_changed' }
    }
    if (!workspace.ok) {
      return { ok: false, reason: 'unavailable', cause: workspace.cause }
    }
    if (workspace.token) {
      return {
        ok: true,
        header: { Authorization: `Bearer ${workspace.token}` },
        owner
      }
    }
    if (authStore.isAuthenticated) return { ok: false, reason: 'unauthorized' }
    const apiKeyHeader = apiKeyAuthStore.getAuthHeader()
    return apiKeyHeader
      ? { ok: true, header: apiKeyHeader, owner }
      : { ok: false, reason: 'signed_out' }
  }

  async function signedInCredential(): Promise<CredentialLookup> {
    const credential = await deployCredential()
    if (credential.ok || credential.reason !== 'signed_out') return credential
    if (!(await showSignInDialog())) return credential
    const retried = await deployCredential()
    if (retried.ok || retried.reason !== 'signed_out') return retried
    return { ok: false, reason: 'unauthorized' }
  }

  async function uploadInstallation(): Promise<OwnedBundleResult> {
    const credential = await signedInCredential()
    if (!credential.ok) return credential
    if (credential.owner !== authStore.currentUserIdentity()) {
      return { ok: false, reason: 'identity_changed' }
    }
    return {
      ...(await createInstallationBundle(credential.header)),
      owner: credential.owner
    }
  }

  function notifyFailure(reason: BundleFailureReason, cause: unknown) {
    if (REPORTED_REASONS.has(reason)) {
      reportError(cause ?? reason, {
        errorType: 'error_creating_installation_bundle',
        surface: 'platform',
        context: { reason }
      })
    }
    toast.error(t(FAILURE_MESSAGE_KEY[reason]))
  }

  async function deploy(): Promise<boolean> {
    if (deployment.value.status === 'uploading') return false
    deployment.value = { status: 'uploading' }
    const result = await uploadInstallation()
    if ('owner' in result && result.owner !== authStore.currentUserIdentity()) {
      deployment.value = { status: 'idle' }
      return false
    }
    if (!result.ok) {
      deployment.value = { status: 'idle' }
      if (
        result.reason !== 'signed_out' &&
        result.reason !== 'identity_changed'
      ) {
        notifyFailure(result.reason, result.cause)
      }
      return false
    }
    const opened = openInNewTab(result.url)
    deployment.value = opened
      ? { status: 'opened' }
      : { status: 'tab_blocked', url: result.url, owner: result.owner }
    return opened
  }

  function markOpened() {
    deployment.value = { status: 'opened' }
  }

  return { state: readonly(state), deploy, markOpened }
}
