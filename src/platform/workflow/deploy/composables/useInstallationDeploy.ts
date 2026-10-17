import { readonly, ref } from 'vue'

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

type InstallationDeployState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'tab_blocked'; url: string }

type DeployFailure = {
  ok: false
  reason: BundleFailureReason | 'signed_out'
  cause?: unknown
}

type TokenLookup =
  | { ok: true; token: string | undefined }
  | { ok: false; cause: unknown }

type CredentialLookup = { ok: true; header: AuthHeader } | DeployFailure

const FAILURE_MESSAGE_KEY = {
  unauthorized: 'deployToComfyApi.bundleUnauthorized',
  too_many_bundles: 'deployToComfyApi.bundleTooMany',
  too_large: 'deployToComfyApi.bundleTooLarge',
  offline: 'deployToComfyApi.bundleUnavailable',
  unavailable: 'deployToComfyApi.bundleUnavailable',
  invalid_request: 'deployToComfyApi.bundleRejected'
} satisfies Record<BundleFailureReason, string>

const REPORTED_REASONS: ReadonlySet<BundleFailureReason> = new Set([
  'unavailable',
  'invalid_request'
])

function openInNewTab(url: string): boolean {
  const tab = window.open(url, '_blank')
  if (tab) tab.opener = null
  return tab !== null || isDesktop || window.__comfyDesktop2 !== undefined
}

/** Uploads the local installation and opens the pre-filled build wizard. */
export function useInstallationDeploy() {
  const authStore = useAuthStore()
  const apiKeyAuthStore = useApiKeyAuthStore()
  const { showSignInDialog } = useAuthDialogs()
  const toast = useToast()
  const state = ref<InstallationDeployState>({ status: 'idle' })

  async function workspaceToken(): Promise<TokenLookup> {
    try {
      return { ok: true, token: await authStore.getWorkspaceAuthToken() }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async function deployCredential(): Promise<CredentialLookup> {
    const workspace = await workspaceToken()
    if (!workspace.ok) {
      return { ok: false, reason: 'unavailable', cause: workspace.cause }
    }
    if (workspace.token) {
      return {
        ok: true,
        header: { Authorization: `Bearer ${workspace.token}` }
      }
    }
    if (authStore.isAuthenticated) return { ok: false, reason: 'unauthorized' }
    const apiKeyHeader = apiKeyAuthStore.getAuthHeader()
    return apiKeyHeader
      ? { ok: true, header: apiKeyHeader }
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

  async function uploadInstallation(): Promise<BundleResult | DeployFailure> {
    const credential = await signedInCredential()
    if (!credential.ok) return credential
    return createInstallationBundle(credential.header)
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
    if (state.value.status === 'uploading') return false
    state.value = { status: 'uploading' }
    const result = await uploadInstallation()
    if (!result.ok) {
      state.value = { status: 'idle' }
      if (result.reason !== 'signed_out') {
        notifyFailure(result.reason, result.cause)
      }
      return false
    }
    const opened = openInNewTab(result.url)
    state.value = opened
      ? { status: 'idle' }
      : { status: 'tab_blocked', url: result.url }
    return opened
  }

  return { state: readonly(state), deploy }
}
