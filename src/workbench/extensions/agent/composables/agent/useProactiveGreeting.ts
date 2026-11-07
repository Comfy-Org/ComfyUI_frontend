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
  | { status: 'never-sent'; scope: string }
  | { status: 'has-sent'; scope: string }

interface Options {
  assignment: () => AgentGreetingAssignment | undefined
  identity: () => { userId: string | null; workspaceId: string | null }
  active: () => boolean
  canvas: () => AgentGreeting['canvas']
  getUsageStatus: (options: {
    signal: AbortSignal
  }) => Promise<AgentUsageStatusResponse>
  requireLocalInstallation?: boolean
  canEnroll?: () => Promise<boolean>
  onEnrolled?: (metadata: ProactiveGreetingEnrolledMetadata) => void
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
    if (!options.active() || !assignment.value || !currentScope) {
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
      if (isStale()) return
      if (!matchesUsageScope(result)) return
      if (!result.has_used_agent && options.canEnroll) {
        if (!(await options.canEnroll())) return
        if (isStale()) return
      }
      applyUsageStatus(result, currentScope)
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

  function applyUsageStatus(
    result: AgentUsageStatusResponse,
    currentScope: string
  ): void {
    state.value = {
      status: result.has_used_agent ? 'has-sent' : 'never-sent',
      scope: currentScope
    }
    const telemetry = assignment.value?.telemetry
    if (!result.has_used_agent && telemetry && options.onEnrolled) {
      options.onEnrolled({ ...telemetry, canvas_state: options.canvas() })
      enrollment.value = { scope: currentScope, telemetry: { ...telemetry } }
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
    return { variant: assignment.value.variant, canvas: options.canvas() }
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
