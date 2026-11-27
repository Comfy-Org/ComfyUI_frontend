import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { skillPacksReporting } from '@/platform/skills/api/skillPacksReporting'
import { listBuiltinSkills } from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { BuiltinSkill } from '@/platform/skills/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

export const useBuiltinSkillsStore = defineStore('builtinSkills', () => {
  const skillPacks = useSkillPacksStore()
  const skills = ref<BuiltinSkill[]>([])
  const loading = ref(false)
  const hasLoaded = ref(false)
  const catalogConfirmed = ref(false)
  const loadFailed = ref(false)
  const routesAvailable = ref(true)
  const catalogRequested = ref(false)

  let fetchGeneration = 0
  let inFlight: Promise<boolean> | undefined

  const { resolvedUserInfo } = useCurrentUser()
  const workspace = useTeamWorkspaceStore()

  function currentScope(): string {
    return JSON.stringify([
      location.origin,
      api.apiURL('/agent/skills/builtin'),
      resolvedUserInfo.value?.id ?? null,
      workspace.workspaceId ?? null
    ])
  }

  const scope = ref(currentScope())

  const visibleSkills = computed<BuiltinSkill[]>(() => {
    const userSkillNames = new Set(skillPacks.packs.map((pack) => pack.name))
    return skills.value.filter((skill) => !userSkillNames.has(skill.name))
  })

  function invalidateCatalog(): void {
    fetchGeneration++
    inFlight = undefined
    skills.value = []
    loading.value = false
    hasLoaded.value = false
    catalogConfirmed.value = false
    loadFailed.value = false
    routesAvailable.value = true
  }

  function markUnavailable(): void {
    fetchGeneration++
    inFlight = undefined
    loading.value = false
    routesAvailable.value = false
    hasLoaded.value = false
    catalogConfirmed.value = false
    loadFailed.value = false
    skills.value = []
  }

  watch(
    currentScope,
    (next) => {
      scope.value = next
      invalidateCatalog()
      if (
        catalogRequested.value &&
        skillPacks.enabled &&
        resolvedUserInfo.value
      ) {
        void ensureSkills()
      }
    },
    { flush: 'sync' }
  )

  watch(
    () => skillPacks.enabled,
    (isEnabled, wasEnabled) => {
      if (wasEnabled && !isEnabled) invalidateCatalog()
      if (!wasEnabled && isEnabled && catalogRequested.value) {
        void ensureSkills()
      }
    },
    { flush: 'sync' }
  )

  function reportFetchFailure(error: unknown): void {
    reportError(error, {
      errorType: 'error_fetching_agent_builtin_skills',
      surface: 'agent',
      ...skillPacksReporting(error)
    })
  }

  function syncScope(): void {
    const next = currentScope()
    if (scope.value === next) return
    scope.value = next
    invalidateCatalog()
  }

  function isCurrentScope(requestScope: string): boolean {
    syncScope()
    return requestScope === scope.value
  }

  function isSuperseded(generation: number, requestScope: string): boolean {
    return !isCurrentScope(requestScope) || generation !== fetchGeneration
  }

  function applyCatalog(nextSkills: BuiltinSkill[]): void {
    skills.value = nextSkills
    hasLoaded.value = true
    catalogConfirmed.value = true
    routesAvailable.value = true
    loadFailed.value = false
  }

  async function fetchSkillsOnce(): Promise<boolean> {
    const generation = ++fetchGeneration
    const requestScope = scope.value
    loading.value = true
    loadFailed.value = false
    try {
      const result = await listBuiltinSkills()
      if (isSuperseded(generation, requestScope)) return false
      if (result.status === 'unavailable') {
        markUnavailable()
        return false
      }
      if (result.status === 'error') {
        loadFailed.value = true
        reportFetchFailure(result.error)
        return false
      }
      applyCatalog(result.skills)
      return true
    } finally {
      if (generation === fetchGeneration) loading.value = false
    }
  }

  function fetchSkills(): Promise<boolean> {
    syncScope()
    catalogRequested.value = true
    if (inFlight) return inFlight
    const request = fetchSkillsOnce().finally(() => {
      if (inFlight === request) inFlight = undefined
    })
    inFlight = request
    return request
  }

  async function refreshSkills(): Promise<void> {
    syncScope()
    if (!skillPacks.enabled) return
    await fetchSkills()
  }

  async function ensureSkills(): Promise<void> {
    syncScope()
    if (
      !skillPacks.enabled ||
      !routesAvailable.value ||
      loading.value ||
      hasLoaded.value ||
      loadFailed.value
    )
      return
    await fetchSkills()
  }

  return {
    skills,
    visibleSkills,
    loading,
    hasLoaded,
    catalogConfirmed,
    loadFailed,
    routesAvailable,
    catalogRequested,
    scope,
    refreshSkills,
    ensureSkills
  }
})
