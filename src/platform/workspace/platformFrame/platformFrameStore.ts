import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { connectPlatformFrame } from '@/platform/workspace/platformFrame/platformFrameBridge'
import type {
  FrameMessage,
  HandedWorkflow
} from '@/platform/workspace/platformFrame/platformFrameMessages'
import {
  platformFrameOrigin,
  platformFrameUrl
} from '@/platform/workspace/platformFrame/platformFrameUrl'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { captureOpenWorkflow } from '@/platform/workspace/platformWorkflowHandoff'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
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
  }

  function open(request: PlatformFrameRequest): boolean {
    const origin = platformFrameOrigin()
    if (!isAvailable() || origin === null) return false
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
    if (message.type === 'build-started') close()
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

  return { session, isUnanswered, isAvailable, open, attach, close }
})
