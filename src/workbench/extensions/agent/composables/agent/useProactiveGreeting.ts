import type { AgentUsageStatusResponse } from '@comfyorg/ingest-types'
import type {
  ProactiveGreetingEnrolledMetadata,
  ProactiveGreetingTelemetryContext
} from '@comfyorg/telemetry/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

import type {
  AgentGreeting,
  AgentGreetingAssignment
} from '@/workbench/extensions/agent/types/proactiveGreeting'

type UsageState =
  | { status: 'unknown' }
  | { status: 'never-sent'; scope: string; copyLocale?: string }
  | { status: 'has-sent'; scope: string }

interface Options {
  assignment: () => AgentGreetingAssignment | undefined
  identity: () => { userId: string | null; workspaceId: string | null }
  active: () => boolean
  canvas: () => AgentGreeting['canvas']
  copyLocale?: (greeting: AgentGreeting) => string | undefined
  getUsageStatus: (options: {
    signal: AbortSignal
  }) => Promise<AgentUsageStatusResponse>
  requireLocalInstallation?: boolean
  onEnrolled: (
    metadata: ProactiveGreetingEnrolledMetadata
  ) => boolean | Promise<boolean>
}

export function useProactiveGreeting(options: Options) {
  const state = shallowRef<UsageState>({ status: 'unknown' })
  const enrollment = shallowRef<{
    scope: string
    telemetry: ProactiveGreetingTelemetryContext
  }>()
  const scope = computed(() => {
    const identity = options.identity()
    return identity.userId && identity.workspaceId
      ? JSON.stringify([identity.userId, identity.workspaceId])
      : null
  })
  const assignment = computed(() => {
    const candidate = options.assignment()
    const identity = options.identity()
    return candidate?.userId === identity.userId &&
      candidate.workspaceId === identity.workspaceId
      ? candidate
      : undefined
  })
  let controller: AbortController | undefined
  let generation = 0
  let disposed = false

  function invalidate(): void {
    ++generation
    controller?.abort()
    controller = undefined
  }

  async function refresh(): Promise<void> {
    if (disposed) return
    invalidate()
    const currentScope = scope.value
    if (state.value.status === 'has-sent' && state.value.scope === currentScope)
      return
    if (!options.active() || !assignment.value?.telemetry || !currentScope) {
      state.value = { status: 'unknown' }
      return
    }
    state.value = { status: 'unknown' }
    await readUsageStatus(currentScope)
  }

  async function readUsageStatus(currentScope: string): Promise<void> {
    const request = new AbortController()
    controller = request
    const currentGeneration = generation
    const isStale = (): boolean =>
      request.signal.aborted ||
      currentGeneration !== generation ||
      currentScope !== scope.value
    try {
      const result = await options.getUsageStatus({ signal: request.signal })
      if (isStale() || !matchesUsageScope(result)) return
      if (result.has_used_agent) {
        state.value = { status: 'has-sent', scope: currentScope }
        return
      }
      await enroll(currentScope, isStale)
    } catch (error) {
      if (isStale()) return
      state.value = { status: 'unknown' }
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_loading_agent_usage_status',
        level: 'warning'
      })
    }
  }

  function matchesUsageScope(result: AgentUsageStatusResponse): boolean {
    return (
      !options.requireLocalInstallation || result.scope === 'local_installation'
    )
  }

  async function enroll(
    currentScope: string,
    isStale: () => boolean
  ): Promise<void> {
    const current = assignment.value
    if (!current?.telemetry) return
    const candidate = { variant: current.variant, canvas: options.canvas() }
    const copyLocale = options.copyLocale?.(candidate)
    const admitted = await options.onEnrolled({
      ...current.telemetry,
      canvas_state: candidate.canvas,
      ...(copyLocale && { copy_locale: copyLocale })
    })
    if (isStale()) return
    if (!admitted) {
      if (enrollment.value?.scope === currentScope) enrollment.value = undefined
      return
    }
    enrollment.value = {
      scope: currentScope,
      telemetry: { ...current.telemetry }
    }
    state.value = {
      status: 'never-sent',
      scope: currentScope,
      copyLocale
    }
  }

  function accepted(sentScope: string | null): void {
    if (disposed || !sentScope || sentScope !== scope.value) return
    invalidate()
    state.value = { status: 'has-sent', scope: sentScope }
  }

  watch([scope, assignment, options.active], () => void refresh(), {
    immediate: true,
    flush: 'sync'
  })
  onScopeDispose(() => {
    disposed = true
    invalidate()
  })
  const greeting = computed<AgentGreeting | undefined>(() => {
    if (
      !options.active() ||
      !assignment.value ||
      state.value.status !== 'never-sent' ||
      state.value.scope !== scope.value
    )
      return
    const { copyLocale } = state.value
    return {
      variant: assignment.value.variant,
      canvas: options.canvas(),
      ...(copyLocale && { copyLocale })
    }
  })
  const attribution = computed(() => {
    const enrolled = enrollment.value
    const current = assignment.value?.telemetry
    if (
      enrolled?.scope === scope.value &&
      current?.group_key === enrolled.telemetry.group_key &&
      current.variant === enrolled.telemetry.variant
    )
      return enrolled.telemetry
  })
  return { greeting, scope, attribution, refresh, accepted }
}
