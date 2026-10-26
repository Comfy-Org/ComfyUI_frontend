import { useTimeoutFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { useAuthStore } from '@/stores/authStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'

export type LocalAgentGrantArm = 'control' | 'treatment' | 'unknown'

type ArmReadOutcome =
  | { kind: 'resolved'; arm: LocalAgentGrantArm }
  | { kind: 'failed'; retryable: boolean }

type ArmReadState =
  | { phase: 'idle' }
  | {
      phase: 'reading' | 'retryScheduled' | 'failed'
      scope: string
      lastRequestedAt: number
    }
  | { phase: 'resolved'; scope: string; arm: LocalAgentGrantArm }

const AUTOMATIC_RETRY_DELAY_MS = 2_000
const USER_RETRY_COOLDOWN_MS = 30_000

function parseArm(features: unknown): LocalAgentGrantArm {
  if (
    typeof features !== 'object' ||
    features === null ||
    !('agent_gratis_local_arm' in features)
  )
    return 'unknown'

  const assignment = features.agent_gratis_local_arm
  return assignment === 'control' || assignment === 'treatment'
    ? assignment
    : 'unknown'
}

export const useLocalAgentGrantReadStore = defineStore(
  'localAgentGrantRead',
  () => {
    const authStore = useAuthStore()
    const consentStore = useAgentConsentStore()
    const state = shallowRef<ArmReadState>({ phase: 'idle' })
    const arm = computed<LocalAgentGrantArm>(() =>
      state.value.phase === 'resolved' ? state.value.arm : 'unknown'
    )
    let currentScope: string | null = null
    let generation = 0
    let pending: Promise<void> | null = null
    let controller: AbortController | null = null

    async function readArm(signal: AbortSignal): Promise<ArmReadOutcome> {
      let headers: Awaited<ReturnType<typeof authStore.getUserAuthHeader>>
      try {
        headers = await authStore.getUserAuthHeader()
      } catch {
        return { kind: 'failed', retryable: true }
      }
      if (signal.aborted) return { kind: 'failed', retryable: false }
      if (!headers) return { kind: 'failed', retryable: false }

      let response: Response
      try {
        response = await fetch(`${getComfyCloudBaseUrl()}/api/features`, {
          headers,
          signal,
          cache: 'no-store',
          redirect: 'error'
        })
      } catch {
        return { kind: 'failed', retryable: true }
      }
      if (!response.ok)
        return {
          kind: 'failed',
          retryable:
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500
        }

      try {
        const features: unknown = await response.json()
        return { kind: 'resolved', arm: parseArm(features) }
      } catch {
        return { kind: 'failed', retryable: false }
      }
    }

    const automaticRetry = useTimeoutFn(
      () => {
        if (state.value.phase === 'retryScheduled')
          startRead(state.value.scope, true)
      },
      AUTOMATIC_RETRY_DELAY_MS,
      { immediate: false }
    )

    function startRead(scope: string, automaticRetryUsed: boolean): void {
      if (currentScope !== scope || pending !== null) return
      const requestGeneration = generation
      const requestController = new AbortController()
      const lastRequestedAt = performance.now()
      controller = requestController
      state.value = {
        phase: 'reading',
        scope,
        lastRequestedAt
      }
      const request = readArm(requestController.signal).then((outcome) => {
        if (requestGeneration !== generation || currentScope !== scope) return
        if (outcome.kind === 'resolved') {
          state.value = { phase: 'resolved', scope, arm: outcome.arm }
        } else {
          if (outcome.retryable && !automaticRetryUsed) {
            state.value = {
              phase: 'retryScheduled',
              scope,
              lastRequestedAt
            }
            automaticRetry.start()
          } else {
            state.value = {
              phase: 'failed',
              scope,
              lastRequestedAt
            }
          }
        }
      })
      pending = request
      void request.finally(() => {
        if (pending === request) {
          pending = null
          controller = null
        }
      })
    }

    function rereadIfFailed(): void {
      const current = state.value
      if (
        (current.phase !== 'failed' && current.phase !== 'retryScheduled') ||
        pending !== null ||
        performance.now() - current.lastRequestedAt < USER_RETRY_COOLDOWN_MS
      )
        return
      automaticRetry.stop()
      startRead(current.scope, true)
    }

    function setScope(nextScope: string | null): void {
      if (nextScope === currentScope) {
        rereadIfFailed()
        return
      }
      generation++
      automaticRetry.stop()
      controller?.abort()
      pending = null
      controller = null
      currentScope = nextScope
      state.value = { phase: 'idle' }
      if (nextScope !== null) startRead(nextScope, false)
    }

    watch(
      [() => consentStore.identity, () => consentStore.accepted],
      ([identity, accepted]) => {
        if (currentScope !== null && (!accepted || identity !== currentScope))
          setScope(null)
      },
      { flush: 'sync' }
    )

    onScopeDispose(() => setScope(null))

    return { state, arm, setScope, rereadIfFailed }
  }
)
