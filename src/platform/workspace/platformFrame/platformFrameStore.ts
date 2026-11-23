import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import {
  advanceBuild,
  forgetBuild,
  isAbout,
  isInFlight,
  isOwnedBy,
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
  const isHidden = ref(false)
  let buildNotice: ToastId | undefined
  let sessions = 0
  let stopBridge: (() => void) | undefined
  let unansweredTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retriedSignIn = false
  let resumeCheck: ReturnType<typeof setInterval> | undefined
  let finishGrace: ReturnType<typeof setTimeout> | undefined

  const { resolvedUserInfo } = useCurrentUser()
  const accountId = computed(() => resolvedUserInfo.value?.id ?? null)
  const workspaceId = computed(
    () => useTeamWorkspaceStore().activeWorkspaceId ?? null
  )

  function currentOwner(): BuildOwner {
    return { accountId: accountId.value, workspaceId: workspaceId.value }
  }

  function isStillOwner(owner: BuildOwner): boolean {
    return (
      owner.accountId === accountId.value &&
      owner.workspaceId === workspaceId.value
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

  function close() {
    stopBridge?.()
    stopBridge = undefined
    stopWaiting()
    clearTimeout(retryTimer)
    retryTimer = undefined
    clearTimeout(finishGrace)
    finishGrace = undefined
    stopResumeCheck()
    isUnanswered.value = false
    session.value = null
    build.value = null
    isHidden.value = false
  }

  function reveal() {
    if (session.value) isHidden.value = false
  }

  function dismiss() {
    if (isInFlight(build.value)) isHidden.value = true
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
    retriedSignIn = false
    waitForAnswer()
  }

  function open(request: PlatformFrameRequest): boolean {
    const origin = platformFrameOrigin()
    if (!isAvailable() || origin === null) return false
    const current = build.value
    if (current && isInFlight(current) && isOwnedBy(current, currentOwner())) {
      reveal()
      return true
    }
    close()
    mount(request, origin, currentOwner())
    return true
  }

  function dropForAnotherOwner() {
    if (buildNotice !== undefined) useToast().dismiss(buildNotice)
    buildNotice = undefined
    if (!session.value) return
    forgetBuild()
    close()
  }

  watch([accountId, workspaceId], dropForAnotherOwner, { flush: 'sync' })

  function stopResumeCheck() {
    clearInterval(resumeCheck)
    resumeCheck = undefined
  }

  function landedRelease(): boolean {
    const current = build.value
    if (!current) return false
    return useDeploymentPickStore().deployments.some(
      (deployment) =>
        deployment.release_id === current.releaseId &&
        deployment.status === 'ready' &&
        (current.kind === 'new' ||
          deployment.deployment_id === current.deploymentId)
    )
  }

  async function checkLanded() {
    await useDeploymentPickStore().load()
    const current = build.value
    if (!resumeCheck || !current || buildNotice === undefined) return
    if (landedRelease()) finishFromListing(current, buildNotice)
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
    buildNotice = createToastId()
    mount(
      { step: 'follow', releaseId: kept.releaseId, version: kept.version },
      origin,
      { accountId: kept.accountId, workspaceId: kept.workspaceId }
    )
    isHidden.value = true
    noticeBuildStarted(kept, buildNotice)
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
    build.value = startFollowing(message, running, currentOwner())
    keepBuild(build.value)
    buildNotice = createToastId()
    isHidden.value = true
    noticeBuildStarted(build.value, buildNotice)
    void pickStore.load()
  }

  async function reloadOntoVersion(deployment: string) {
    if (!(await confirmUnsavedWorkBeforeSwitch(deployment))) return
    const pickStore = useDeploymentPickStore()
    if (pickStore.isSwitching) return
    skipLeavePromptOnce()
    reloadForDeploymentSwitch(() => void pickStore.load())
  }

  function tellReady(done: FollowedBuild, id: ToastId) {
    const pickStore = useDeploymentPickStore()
    const runsHere =
      done.kind === 'update' &&
      pickStore.bootDeployment?.deployment_id === done.deploymentId
    noticeBuildReady(done, id, {
      openRunOn: pickStore.requestSwitcherOpen,
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

  function take(message: FrameMessage) {
    if (message.type === 'ready') {
      stopWaiting()
      isUnanswered.value = false
      if (!message.signedIn) reloadForSignIn()
    }
    if (message.type === 'build-started') startBuild(message)
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
      }
    })
  }

  return {
    session,
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
