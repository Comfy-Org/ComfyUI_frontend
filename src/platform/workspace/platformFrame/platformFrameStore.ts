import { defineStore } from 'pinia'
import { computed, getCurrentScope, ref, shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { CustomDeploymentEntry } from '@comfyorg/telemetry/types'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { switchToDeployment } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import {
  trackDeploymentCreateClicked,
  trackDeploymentDialogOpened
} from '@/platform/workspace/platformFrame/customDeploymentTelemetry'
import {
  advanceBuild,
  forgetBuild,
  holdsFrame,
  isAbout,
  isInFlight,
  isOwnedBy,
  isReadyNewsFor,
  keepBuild,
  readKeptBuild,
  startFollowing
} from '@/platform/workspace/platformFrame/platformFrameBuild'
import type {
  BuildOwner,
  FollowedBuild
} from '@/platform/workspace/platformFrame/platformFrameBuild'
import { connectPlatformFrame } from '@/platform/workspace/platformFrame/platformFrameBridge'
import type {
  FrameMessage,
  HandedWorkflow
} from '@/platform/workspace/platformFrame/platformFrameMessages'
import {
  noticeBuildFailed,
  noticeBuildReady,
  noticeBuildStarted
} from '@/platform/workspace/platformFrame/platformFrameNotices'
import {
  platformFrameOrigin,
  platformFrameUrl,
  platformVersionPageUrl
} from '@/platform/workspace/platformFrame/platformFrameUrl'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { captureOpenWorkflow } from '@/platform/workspace/platformWorkflowHandoff'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import { createToastId } from '@/types/toastId'
import type { ToastId } from '@/types/toastId'
import { createUuidv4 } from '@/utils/uuid'

export const PLATFORM_FRAME_UNANSWERED_MS = 10_000

export const PLATFORM_FRAME_SIGN_IN_RETRY_MS = 2_000

export const PLATFORM_FRAME_RESUME_CHECK_MS = 30_000

export const PLATFORM_FRAME_FINISH_GRACE_MS = 30 * 60_000

export const PLATFORM_FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'

interface PlatformFrameSession {
  id: number
  request: PlatformFrameRequest
  url: string
  platformOrigin: string
  nonce: string
  workflow: HandedWorkflow | null
  owner: BuildOwner
}

export const usePlatformFrameStore = defineStore('platformFrame', () => {
  const session = shallowRef<PlatformFrameSession | null>(null)
  const isUnanswered = ref(false)
  const build = shallowRef<FollowedBuild | null>(null)
  const contentHeight = ref<number | null>(null)
  const isHidden = ref(false)
  let buildNotice: ToastId | undefined
  const ownedNotices = new Set<ToastId>()
  let sessions = 0
  let stopBridge: (() => void) | undefined
  let unansweredTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retriedSignIn = false
  let resumeCheck: ReturnType<typeof setInterval> | undefined
  let finishGrace: ReturnType<typeof setTimeout> | undefined

  const scope = getCurrentScope()
  let identity: ComputedRef<string | null> | undefined
  const workspaceId = computed(
    () => useTeamWorkspaceStore().activeWorkspaceId ?? null
  )

  function watchIdentity(): ComputedRef<string | null> {
    const { resolvedUserInfo } = useCurrentUser()
    const signedIn = computed(() => resolvedUserInfo.value?.id ?? null)
    watch([signedIn, workspaceId], dropForAnotherOwner, { flush: 'sync' })
    return signedIn
  }

  function accountId(): string | null {
    identity ??= scope?.run(watchIdentity) ?? watchIdentity()
    return identity.value
  }

  function currentOwner(): BuildOwner {
    return { accountId: accountId(), workspaceId: workspaceId.value }
  }

  function isStillOwner(owner: BuildOwner): boolean {
    return (
      owner.accountId === accountId() && owner.workspaceId === workspaceId.value
    )
  }

  function isAvailable(): boolean {
    return (
      isCloud &&
      useFeatureFlags().flags.customDeploymentsEditorEnabled &&
      platformFrameOrigin() !== null
    )
  }

  function stopWaiting() {
    clearTimeout(unansweredTimer)
    unansweredTimer = undefined
  }

  function waitForAnswer() {
    stopWaiting()
    unansweredTimer = setTimeout(() => {
      isUnanswered.value = true
    }, PLATFORM_FRAME_UNANSWERED_MS)
  }

  function cancelRetry() {
    clearTimeout(retryTimer)
    retryTimer = undefined
  }

  function close() {
    stopBridge?.()
    stopBridge = undefined
    stopWaiting()
    cancelRetry()
    clearTimeout(finishGrace)
    finishGrace = undefined
    stopResumeCheck()
    isUnanswered.value = false
    session.value = null
    contentHeight.value = null
    build.value = null
    isHidden.value = false
  }

  function reveal() {
    if (session.value) isHidden.value = false
  }

  function dismiss() {
    if (holdsFrame(build.value)) isHidden.value = true
    else close()
  }

  function mount(
    request: PlatformFrameRequest,
    origin: string,
    owner: BuildOwner
  ) {
    session.value = {
      id: ++sessions,
      request,
      url: platformFrameUrl(request, owner.workspaceId),
      platformOrigin: origin,
      nonce: createUuidv4(),
      workflow: request.handsOverWorkflow ? captureOpenWorkflow() : null,
      owner
    }
    contentHeight.value = null
    retriedSignIn = false
    waitForAnswer()
  }

  function open(
    request: PlatformFrameRequest,
    entry: CustomDeploymentEntry
  ): boolean {
    const origin = platformFrameOrigin()
    if (!isAvailable() || origin === null) return false
    const current = build.value
    if (current && holdsFrame(current) && isOwnedBy(current, currentOwner())) {
      reveal()
      return true
    }
    close()
    const owner = currentOwner()
    mount(request, origin, owner)
    trackDeploymentDialogOpened(entry, request, owner.workspaceId)
    return true
  }

  function nextBuildNotice(): ToastId {
    const shown = new Set(useToast().toasts.map((toast) => toast.id))
    for (const id of ownedNotices) if (!shown.has(id)) ownedNotices.delete(id)
    buildNotice = createToastId()
    ownedNotices.add(buildNotice)
    return buildNotice
  }

  function dropForAnotherOwner() {
    const toast = useToast()
    for (const id of ownedNotices) toast.dismiss(id)
    ownedNotices.clear()
    buildNotice = undefined
    if (!session.value) return
    forgetBuild()
    close()
  }

  function stopResumeCheck() {
    clearInterval(resumeCheck)
    resumeCheck = undefined
  }

  function landedDeployment(current: FollowedBuild) {
    return useDeploymentPickStore().deployments.find(
      (deployment) =>
        deployment.release_id === current.releaseId &&
        deployment.status === 'ready' &&
        (current.deploymentId
          ? deployment.deployment_id === current.deploymentId
          : current.kind === 'new')
    )
  }

  async function checkLanded() {
    await useDeploymentPickStore().load()
    const current = build.value
    if (!resumeCheck || !current || buildNotice === undefined) return
    const landed = landedDeployment(current)
    if (landed)
      finishFromListing(
        { ...current, deploymentId: landed.deployment_id },
        buildNotice
      )
  }

  function checkWhileQuiet() {
    resumeCheck = setInterval(
      () => void checkLanded(),
      PLATFORM_FRAME_RESUME_CHECK_MS
    )
  }

  function isResumable(): boolean {
    if (!isAvailable()) return false
    const owner = currentOwner()
    return owner.accountId !== null && owner.workspaceId !== null
  }

  function resume(): boolean {
    const origin = platformFrameOrigin()
    if (!isResumable() || origin === null) return false
    if (session.value || build.value) return false
    const kept = readKeptBuild()
    if (!kept) return false
    if (!isOwnedBy(kept, currentOwner())) {
      forgetBuild()
      return false
    }
    build.value = kept
    const notice = nextBuildNotice()
    mount(
      { step: 'follow', releaseId: kept.releaseId, version: kept.version },
      origin,
      { accountId: kept.accountId, workspaceId: kept.workspaceId }
    )
    isHidden.value = true
    noticeBuildStarted(kept, notice)
    checkWhileQuiet()
    return true
  }

  function startBuild(
    message: Extract<FrameMessage, { type: 'build-started' }>
  ) {
    const pickStore = useDeploymentPickStore()
    const running =
      message.kind === 'update'
        ? pickStore.deployments.find(
            (deployment) => deployment.deployment_id === message.deploymentId
          )
        : undefined
    const isNew = build.value?.buildId !== message.buildId
    build.value = startFollowing(message, running, currentOwner())
    if (isNew) trackDeploymentCreateClicked(build.value)
    keepBuild(build.value)
    const notice = nextBuildNotice()
    isHidden.value = true
    noticeBuildStarted(build.value, notice)
    void pickStore.load()
  }

  async function reloadOntoVersion(deployment: string) {
    if (!(await confirmUnsavedWorkBeforeSwitch(deployment, { reload: true })))
      return
    const pickStore = useDeploymentPickStore()
    if (pickStore.isSwitching) return
    skipLeavePromptOnce()
    reloadForDeploymentSwitch(() => void pickStore.load())
  }

  async function switchToBuilt(done: FollowedBuild) {
    const pickStore = useDeploymentPickStore()
    let backstop: ReturnType<typeof setTimeout> | undefined
    const loaded = await Promise.race([
      pickStore.load().then(() => true),
      new Promise<false>((resolve) => {
        backstop = setTimeout(
          () => resolve(false),
          DEPLOYMENT_LISTING_BACKSTOP_MS
        )
      })
    ]).finally(() => clearTimeout(backstop))
    if (pickStore.isSwitching) return
    if (!loaded || pickStore.state.phase !== 'ready') {
      useToast().error(t('deploymentSwitcher.failedToSwitch'), {
        description: t('platformFrame.switchListingUnavailable'),
        duration: 8000
      })
      return
    }
    const target = pickStore.deployments.find(
      (deployment) => deployment.deployment_id === done.deploymentId
    )
    if (target?.status !== 'ready') {
      pickStore.requestSwitcherOpen()
      return
    }
    await switchToDeployment(target.deployment_id, done.deploymentName)
  }

  function tellReady(done: FollowedBuild, id: ToastId) {
    const pickStore = useDeploymentPickStore()
    const runsHere =
      done.kind === 'update' &&
      pickStore.bootDeployment?.deployment_id === done.deploymentId
    noticeBuildReady(done, id, {
      switchTo: () => switchToBuilt(done),
      reload: runsHere
        ? () => void reloadOntoVersion(done.deploymentName)
        : null
    })
  }

  function finishReady(done: FollowedBuild, id: ToastId) {
    if (done.stage !== 'finishing') {
      tellReady(done, id)
      void useDeploymentPickStore().load()
    }
    forgetBuild()
    close()
  }

  function finishFromListing(done: FollowedBuild, id: ToastId) {
    stopResumeCheck()
    forgetBuild()
    tellReady(done, id)
    build.value = { ...done, stage: 'finishing' }
    finishGrace = setTimeout(close, PLATFORM_FRAME_FINISH_GRACE_MS)
  }

  function viewDetails(failed: FollowedBuild, section?: 'deployments') {
    return () => {
      window.open(
        platformVersionPageUrl(failed, section),
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  function settle(next: FollowedBuild) {
    build.value = next
    if (isInFlight(next)) keepBuild(next)
    else forgetBuild()
  }

  function reportFailure(
    failed: FollowedBuild,
    message: Extract<FrameMessage, { type: 'build-failed' | 'deploy-failed' }>
  ) {
    reportError(new Error(message.reason || message.type), {
      surface: 'workspace',
      errorType:
        message.type === 'build-failed'
          ? 'error_building_custom_deployment'
          : 'error_deploying_custom_deployment',
      level: 'warning',
      tags: { kind: failed.kind },
      context: {
        buildId: failed.buildId,
        releaseId: failed.releaseId,
        deploymentId: failed.deploymentId
      }
    })
  }

  function tellOutcome(
    current: FollowedBuild,
    next: FollowedBuild,
    id: ToastId,
    message: FrameMessage
  ) {
    if (message.type === 'deployment-ready') finishReady(next, id)
    if (message.type !== 'build-failed' && message.type !== 'deploy-failed')
      return
    if (current.stage !== 'failed') reportFailure(next, message)
    noticeBuildFailed(
      next,
      id,
      { failed: message.type, reason: message.reason },
      viewDetails(
        next,
        message.type === 'deploy-failed' ? 'deployments' : undefined
      )
    )
  }

  function follow(message: FrameMessage) {
    const current = build.value
    const id = buildNotice
    if (!current || id === undefined || !isAbout(current, message)) return
    if (!isReadyNewsFor(current, message)) return
    if (message.type !== 'deployment-ready') stopResumeCheck()
    const next = advanceBuild(current, message)
    settle(next)
    tellOutcome(current, next, id, message)
  }

  function signedInBySessionOnly(): boolean {
    const authStore = useAuthStore()
    return !authStore.currentUser && !!authStore.sessionUser
  }

  function reloadForSignIn() {
    if (retriedSignIn || retryTimer || !signedInBySessionOnly()) return
    retriedSignIn = true
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      const current = session.value
      if (!current) return
      stopBridge?.()
      stopBridge = undefined
      session.value = { ...current, id: ++sessions }
      waitForAnswer()
    }, PLATFORM_FRAME_SIGN_IN_RETRY_MS)
  }

  function takeSignInHandoff(handedOff: boolean) {
    stopWaiting()
    isUnanswered.value = !handedOff
  }

  function take(message: FrameMessage) {
    if (message.type === 'ready') {
      stopWaiting()
      isUnanswered.value = false
      if (message.signedIn) cancelRetry()
      else reloadForSignIn()
    }
    if (message.type === 'content-height') contentHeight.value = message.height
    else if (message.type === 'build-started') startBuild(message)
    else follow(message)
  }

  function attach(frame: Window) {
    const current = session.value
    if (!current) return
    stopBridge?.()
    const authStore = useAuthStore()
    stopBridge = connectPlatformFrame({
      frame,
      platformOrigin: current.platformOrigin,
      nonce: current.nonce,
      workflow: current.workflow,
      account: {
        uid: () => authStore.currentUser?.uid ?? null,
        idToken: () => authStore.getIdToken()
      },
      onMessage: (message) => {
        if (session.value?.nonce !== current.nonce) return
        if (!isStillOwner(current.owner)) return
        take(message)
      },
      onSignInHandoff: (handedOff) => {
        if (session.value?.nonce !== current.nonce) return
        takeSignInHandoff(handedOff)
      }
    })
  }

  return {
    session,
    contentHeight,
    isUnanswered,
    build,
    isHidden,
    isAvailable,
    isResumable,
    open,
    resume,
    attach,
    reveal,
    dismiss,
    close
  }
})
