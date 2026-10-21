import { ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { createInstallationBundle } from '@/platform/workflow/deploy/api/installationBundleApi'
import type { BundleFailureReason } from '@/platform/workflow/deploy/api/installationBundleApi'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

type InstallationDeployState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'ready'; url: string }

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

type CredentialLookup =
  | { ok: true; header: AuthHeader; owner: string | null }
  | DeployFailure

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

export function useInstallationDeploy() {
  const authStore = useAuthStore()
  const apiKeyAuthStore = useApiKeyAuthStore()
  const workflowStore = useWorkflowStore()
  const { showSignInDialog } = useAuthDialogs()
  const toast = useToast()
  const state = ref<InstallationDeployState>({ status: 'idle' })

  function captureOpenWorkflow() {
    const workflow = workflowStore.activeWorkflow
    workflow?.changeTracker.prepareForSave()
    return workflow?.activeState
  }

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
    const prompt = await promptSignIn()
    if (!prompt.ok) {
      return { ok: false, reason: 'unavailable', cause: prompt.cause }
    }
    if (!prompt.signedIn) return credential
    const retried = await deployCredential()
    if (retried.ok || retried.reason !== 'signed_out') return retried
    return { ok: false, reason: 'unauthorized' }
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

  function stopUploading() {
    state.value = { status: 'idle' }
  }

  function fail(failure: DeployFailure) {
    if (failure.reason !== 'signed_out') {
      notifyFailure(failure.reason, failure.cause)
    }
    stopUploading()
  }

  async function deploy() {
    const workflow = captureOpenWorkflow()
    state.value = { status: 'uploading' }
    const credential = await signedInCredential()
    if (!credential.ok) return fail(credential)
    const { owner } = credential
    if (owner !== authStore.currentUserIdentity()) return stopUploading()
    const bundle = await createInstallationBundle(credential.header, workflow)
    if (owner !== authStore.currentUserIdentity()) return stopUploading()
    if (!bundle.ok) return fail(bundle)
    state.value = { status: 'ready', url: bundle.url }
  }

  return { state, deploy }
}
