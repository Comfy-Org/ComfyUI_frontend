import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import { listSkillPacks, SkillPacksApiError } from '../api/skillsApi'
import type { SkillPack } from '../types'

const AGENT_EXPERIENCE_FLAG = 'agent-in-app-experience'
const SKILL_PACKS_FLAG = 'agent-skill-packs'

export const useSkillPacksStore = defineStore('skillPacks', () => {
  const packs = ref<SkillPack[]>([])
  const loading = ref(false)
  const flagsEnabled = ref(false)
  // Disabled backend gates answer 404, independently of PostHog flags.
  const routesAvailable = ref(true)

  const enabled = computed(() => flagsEnabled.value && routesAvailable.value)

  let flagGateStarted = false
  let fetchGeneration = 0

  async function startFlagGate(): Promise<void> {
    if (flagGateStarted) {
      if (flagsEnabled.value && !routesAvailable.value) {
        void fetchPacks().catch(reportFetchFailure)
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
        // Probe because backend availability can disagree with PostHog.
        if (!wasEnabled && flagsEnabled.value) {
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

  async function fetchPacks(): Promise<void> {
    const generation = ++fetchGeneration
    loading.value = true
    try {
      const nextPacks = await listSkillPacks()
      if (generation !== fetchGeneration) return
      packs.value = nextPacks
      routesAvailable.value = true
    } catch (error) {
      if (generation !== fetchGeneration) return
      if (error instanceof SkillPacksApiError && error.status === 404) {
        markUnavailable()
        return
      }
      throw error
    } finally {
      if (generation === fetchGeneration) loading.value = false
    }
  }

  function upsertPack(pack: SkillPack): void {
    fetchGeneration++
    loading.value = false
    const rest = packs.value.filter((existing) => existing.name !== pack.name)
    packs.value = [...rest, pack].sort((a, b) => a.name.localeCompare(b.name))
  }

  function removePack(name: string): void {
    fetchGeneration++
    loading.value = false
    packs.value = packs.value.filter((pack) => pack.name !== name)
  }

  function markUnavailable(): void {
    fetchGeneration++
    loading.value = false
    routesAvailable.value = false
    packs.value = []
  }

  return {
    packs,
    loading,
    enabled,
    flagsEnabled,
    routesAvailable,
    startFlagGate,
    fetchPacks,
    upsertPack,
    removePack,
    markUnavailable
  }
})
