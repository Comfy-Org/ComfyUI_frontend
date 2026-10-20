import { computed, readonly, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { t } from '@/i18n'
import { isDesktop } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { createInstallationBundle } from '@/platform/workflow/deploy/api/installationBundleApi'
import type { BundleFailureReason } from '@/platform/workflow/deploy/api/installationBundleApi'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

type InstallationDeployState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'opened' }
  | { status: 'tab_blocked'; url: string }

type DeployFailure = {
  ok: false
  reason: BundleFailureReason | 'signed_out'
  cause?: unknown
}

type TokenLookup =
  | { ok: true; token: string | undefined }
  | { ok: false; cause: unknown }

type SignInPrompt =
  | { ok: true; signedIn: boolean }
  | { ok: false; cause: unknown }

type CredentialLookup = ({ ok: true; header: AuthHeader } | DeployFailure) & {
  owner: string | null
}

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

function forgetLinkFromEarlierDialog() {
  if (deployment.value.status === 'tab_blocked') {
    deployment.value = { status: 'idle' }
  }
}

export function useInstallationDeploy() {
  forgetLinkFromEarlierDialog()
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

  async function promptSignIn(): Promise<SignInPrompt> {
    try {
      return { ok: true, signedIn: await showSignInDialog() }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async function deployCredential(): Promise<CredentialLookup> {
    const owner = authStore.currentUserIdentity()
    const workspace = await workspaceToken()
    if (!workspace.ok) {
      return { ok: false, reason: 'unavailable', cause: workspace.cause, owner }
    }
    if (workspace.token) {
      return {
        ok: true,
        header: { Authorization: `Bearer ${workspace.token}` },
        owner
      }
    }
    if (authStore.isAuthenticated) {
      return { ok: false, reason: 'unauthorized', owner }
    }
    const apiKeyHeader = apiKeyAuthStore.getAuthHeader()
    return apiKeyHeader
      ? { ok: true, header: apiKeyHeader, owner }
      : { ok: false, reason: 'signed_out', owner }
  }

  async function signedInCredential(): Promise<CredentialLookup> {
    const credential = await deployCredential()
    if (credential.ok || credential.reason !== 'signed_out') return credential
    const prompt = await promptSignIn()
    if (!prompt.ok) {
      return {
        ok: false,
        reason: 'unavailable',
        cause: prompt.cause,
        owner: credential.owner
      }
    }
    if (!prompt.signedIn) return credential
    const retried = await deployCredential()
    if (retried.ok || retried.reason !== 'signed_out') return retried
    return { ok: false, reason: 'unauthorized', owner: retried.owner }
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

  function stopUploading(): false {
    deployment.value = { status: 'idle' }
    return false
  }

  function fail(failure: DeployFailure): false {
    if (failure.reason !== 'signed_out') {
      notifyFailure(failure.reason, failure.cause)
    }
    return stopUploading()
  }

  async function deploy(): Promise<boolean> {
    if (deployment.value.status === 'uploading') return false
    deployment.value = { status: 'uploading' }
    const credential = await signedInCredential()
    const { owner } = credential
    if (owner !== authStore.currentUserIdentity()) return stopUploading()
    if (!credential.ok) return fail(credential)
    const bundle = await createInstallationBundle(credential.header)
    if (owner !== authStore.currentUserIdentity()) return stopUploading()
    if (!bundle.ok) return fail(bundle)
    const opened = openInNewTab(bundle.url)
    deployment.value = opened
      ? { status: 'opened' }
      : { status: 'tab_blocked', url: bundle.url, owner }
    return opened
  }

  function markOpened() {
    deployment.value = { status: 'opened' }
  }

  return { state: readonly(state), deploy, markOpened }
}
