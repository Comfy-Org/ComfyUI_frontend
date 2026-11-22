import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import {
  advanceBuild,
  isAbout,
  isInFlight,
  startFollowing
} from '@/platform/workspace/platformFrame/platformFrameBuild'
import type { FollowedBuild } from '@/platform/workspace/platformFrame/platformFrameBuild'
import { connectPlatformFrame } from '@/platform/workspace/platformFrame/platformFrameBridge'
import type { FrameMessage } from '@/platform/workspace/platformFrame/platformFrameMessages'
import type { HandedWorkflow } from '@/platform/workspace/platformFrame/platformFrameMessages'
import {
  noticeBuildFailed,
  noticeBuildReady,
  noticeBuildStarted,
  noticeBuildWaiting
} from '@/platform/workspace/platformFrame/platformFrameNotices'
import {
  platformFrameOrigin,
  platformFrameUrl
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

export const PLATFORM_FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'

interface PlatformFrameSession {
  id: number
  request: PlatformFrameRequest
  url: string
  platformOrigin: string
  nonce: string
  workflow: HandedWorkflow | null
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

  function open(request: PlatformFrameRequest): boolean {
    const origin = platformFrameOrigin()
    if (!isAvailable() || origin === null) return false
    if (isInFlight(build.value)) {
      reveal()
      return true
    }
    close()
    session.value = {
      id: ++sessions,
      request,
      url: platformFrameUrl(
        request,
        useTeamWorkspaceStore().activeWorkspaceId ?? null
      ),
      platformOrigin: origin,
      nonce: createUuidv4(),
      workflow: request.handsOverWorkflow ? captureOpenWorkflow() : null
    }
    retriedSignIn = false
    waitForAnswer()
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
    build.value = startFollowing(message, running)
    buildNotice = createToastId()
    isHidden.value = true
    noticeBuildStarted(build.value, buildNotice)
    void pickStore.load()
  }

  function follow(message: FrameMessage) {
    const current = build.value
    if (!current || !isAbout(current, message) || buildNotice === undefined)
      return
    const next = advanceBuild(current, message)
    build.value = next
    const id = buildNotice
    if (message.type === 'build-waiting') noticeBuildWaiting(next, id, reveal)
    if (message.type === 'build-failed' || message.type === 'deploy-failed')
      noticeBuildFailed(
        next,
        id,
        { failed: message.type, reason: message.reason },
        reveal
      )
    if (message.type === 'deployment-ready') {
      const pickStore = useDeploymentPickStore()
      noticeBuildReady(next, id, pickStore.requestSwitcherOpen)
      void pickStore.load()
      close()
    }
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
      onMessage: take
    })
  }

  return {
    session,
    isUnanswered,
    build,
    isHidden,
    isAvailable,
    open,
    attach,
    reveal,
    dismiss,
    close
  }
})
