import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

import { reportError } from '@/platform/telemetry/reportError'

import { listSkillPacks, SkillPacksApiError } from '../api/skillsApi'
import type { SkillPack } from '../types'

const AGENT_EXPERIENCE_FLAG = 'agent-in-app-experience'
const SKILL_PACKS_FLAG = 'agent-skill-packs'

function isRoutesUnavailable(error: unknown): boolean {
  return error instanceof SkillPacksApiError && error.status === 404
}

export const useSkillPacksStore = defineStore('skillPacks', () => {
  const packs = ref<SkillPack[]>([])
  const loading = ref(false)
  const hasLoaded = ref(false)
  // CRUD can populate a partial cache; only a full listing proves absence.
  // Refreshes keep the last confirmation until a response replaces it.
  const catalogConfirmed = ref(false)
  const loadFailed = ref(false)
  const flagsEnabled = ref(false)
  // Disabled backend gates answer 404, independently of PostHog flags.
  const routesAvailable = ref(true)

  const enabled = computed(() => flagsEnabled.value && routesAvailable.value)

  let flagGateStarted = false
  let fetchGeneration = 0
  let inFlight: Promise<void> | undefined
  let catalogRequested = false
  const { resolvedUserInfo } = useCurrentUser()
  const workspace = useTeamWorkspaceStore()
  function currentScope(): string {
    return JSON.stringify([
      location.origin,
      api.apiURL('/agent/skills'),
      resolvedUserInfo.value?.id ?? null,
      workspace.workspaceId ?? null
    ])
  }
  const scope = ref(currentScope())

  function invalidateCatalog(): void {
    fetchGeneration++
    inFlight = undefined
    packs.value = []
    loading.value = false
    hasLoaded.value = false
    catalogConfirmed.value = false
    loadFailed.value = false
    routesAvailable.value = true
  }

  watch(
    currentScope,
    (next) => {
      scope.value = next
      invalidateCatalog()
      if (catalogRequested && flagsEnabled.value && resolvedUserInfo.value)
        void ensurePacks()
    },
    { flush: 'sync' }
  )

  async function startFlagGate({
    fetch = true
  }: { fetch?: boolean } = {}): Promise<void> {
    catalogRequested ||= fetch
    if (flagGateStarted) {
      if (fetch && flagsEnabled.value) {
        if (!routesAvailable.value) void fetchPacks().catch(reportFetchFailure)
        else void ensurePacks()
      }
      return
    }
    flagGateStarted = true
    try {
      const { default: posthog } = await import('posthog-js')
      const sync = () => {
        const wasEnabled = flagsEnabled.value
        flagsEnabled.value =
          posthog.isFeatureEnabled(AGENT_EXPERIENCE_FLAG) === true &&
          posthog.isFeatureEnabled(SKILL_PACKS_FLAG) === true
        if (wasEnabled && !flagsEnabled.value) invalidateCatalog()
        // Probe because backend availability can disagree with PostHog.
        if (!wasEnabled && flagsEnabled.value && catalogRequested) {
          void fetchPacks().catch(reportFetchFailure)
        }
      }
      posthog.onFeatureFlags((_flags, _variants, context) => {
        // Ignore failed flag deliveries.
        if (context?.errorsLoading) return
        sync()
      })
      sync()
    } catch (error) {
      flagGateStarted = false
      reportError(error, {
        errorType: 'agent_skill_packs_flag_gate_failure',
        surface: 'agent'
      })
    }
  }

  function reportFetchFailure(error: unknown): void {
    reportError(error, {
      errorType: 'error_fetching_agent_skill_packs',
      surface: 'agent'
    })
  }

  function syncScope(): void {
    const next = currentScope()
    if (scope.value === next) return
    scope.value = next
    invalidateCatalog()
  }

  function fetchPacks(): Promise<void> {
    syncScope()
    catalogRequested = true
    if (inFlight) return inFlight
    const request = fetchPacksOnce().finally(() => {
      if (inFlight === request) inFlight = undefined
    })
    inFlight = request
    return request
  }

  function isCurrentScope(requestScope: string): boolean {
    syncScope()
    return requestScope === scope.value
  }

  function isSuperseded(generation: number, requestScope: string): boolean {
    return generation !== fetchGeneration || requestScope !== currentScope()
  }

  function applyCatalog(nextPacks: SkillPack[]): void {
    packs.value = nextPacks
    hasLoaded.value = true
    catalogConfirmed.value = true
    routesAvailable.value = true
  }

  async function fetchPacksOnce(): Promise<void> {
    const generation = ++fetchGeneration
    const requestScope = scope.value
    loading.value = true
    loadFailed.value = false
    try {
      const nextPacks = await listSkillPacks()
      if (isSuperseded(generation, requestScope)) return
      applyCatalog(nextPacks)
    } catch (error) {
      if (isSuperseded(generation, requestScope)) return
      if (isRoutesUnavailable(error)) {
        markUnavailable()
        return
      }
      loadFailed.value = true
      throw error
    } finally {
      if (generation === fetchGeneration) loading.value = false
    }
  }

  function upsertPack(pack: SkillPack, requestScope = scope.value): void {
    syncScope()
    if (requestScope !== scope.value) return
    fetchGeneration++
    inFlight = undefined
    loading.value = false
    hasLoaded.value = true
    loadFailed.value = false
    const rest = packs.value.filter((existing) => existing.name !== pack.name)
    packs.value = [...rest, pack].sort((a, b) => a.name.localeCompare(b.name))
  }

  function removePack(name: string, requestScope = scope.value): void {
    syncScope()
    if (requestScope !== scope.value) return
    fetchGeneration++
    inFlight = undefined
    loading.value = false
    packs.value = packs.value.filter((pack) => pack.name !== name)
  }

  function markUnavailable(): void {
    fetchGeneration++
    inFlight = undefined
    loading.value = false
    routesAvailable.value = false
    hasLoaded.value = false
    catalogConfirmed.value = false
    packs.value = []
  }

  async function refreshPacks(): Promise<void> {
    syncScope()
    if (!enabled.value) return
    await fetchPacks().catch(reportFetchFailure)
  }

  // Lists after any in-flight request, so the result covers earlier changes.
  async function refreshPacksInBackground(): Promise<void> {
    syncScope()
    const requestScope = scope.value
    if (inFlight) await inFlight.catch(() => undefined)
    if (!isCurrentScope(requestScope) || !enabled.value) return
    await fetchPacks().catch(reportFetchFailure)
  }

  async function ensurePacks(): Promise<void> {
    syncScope()
    if (
      !enabled.value ||
      loading.value ||
      (hasLoaded.value && !loadFailed.value)
    )
      return
    await refreshPacks()
  }

  return {
    packs,
    loading,
    hasLoaded,
    catalogConfirmed,
    loadFailed,
    scope,
    enabled,
    flagsEnabled,
    routesAvailable,
    startFlagGate,
    fetchPacks,
    refreshPacks,
    refreshPacksInBackground,
    ensurePacks,
    isCurrentScope,
    upsertPack,
    removePack,
    markUnavailable
  }
})
