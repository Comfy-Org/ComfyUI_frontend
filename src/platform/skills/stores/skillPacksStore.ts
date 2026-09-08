import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import { listSkillPacks, SkillPacksApiError } from '../api/skillsApi'
import type { SkillPack } from '../types'
import { packByteSize } from '../types'

/** The parent gate fronting the whole `/api/agent` surface. */
const AGENT_EXPERIENCE_FLAG = 'agent-in-app-experience'
/** The cohort gate fronting the skill-pack CRUD routes specifically. */
const SKILL_PACKS_FLAG = 'agent-skill-packs'

/**
 * Shared skill-pack state. It is a store rather than plain composable state
 * because the settings navigation and the panel have to agree on whether the
 * surface exists at all: a 404 the panel's own list request discovers has to
 * remove the nav entry too.
 */
export const useSkillPacksStore = defineStore('skillPacks', () => {
  const packs = ref<SkillPack[]>([])
  const loading = ref(false)
  /** Both cohort flags, read from PostHog. Both default off and fail closed. */
  const flagsEnabled = ref(false)
  /**
   * Flipped false by a 404 from the routes, which is how both gates answer when
   * off — so the flag read at load is never the only signal.
   */
  const routesAvailable = ref(true)

  const enabled = computed(() => flagsEnabled.value && routesAvailable.value)

  const totalBytes = computed(() =>
    packs.value.reduce((sum, pack) => sum + packByteSize(pack), 0)
  )

  let flagGateStarted = false

  /**
   * Subscribes to both cohort flags. PostHog is imported lazily so a build with
   * no PostHog project token never pays for it, matching how the agent panel's
   * own gate is wired.
   */
  async function startFlagGate(): Promise<void> {
    if (flagGateStarted) return
    flagGateStarted = true
    try {
      const { default: posthog } = await import('posthog-js')
      const sync = () => {
        const wasEnabled = flagsEnabled.value
        flagsEnabled.value =
          posthog.isFeatureEnabled(AGENT_EXPERIENCE_FLAG) === true &&
          posthog.isFeatureEnabled(SKILL_PACKS_FLAG) === true
        // The flags can disagree with the deployed backend, so probe the routes
        // once rather than advertising a surface that answers 404.
        if (!wasEnabled && flagsEnabled.value) void fetchPacks().catch(() => {})
      }
      posthog.onFeatureFlags((_flags, _variants, context) => {
        // A pre-init errorsLoading is an error report, not a flag delivery.
        if (context?.errorsLoading) return
        sync()
      })
      sync()
    } catch (error) {
      reportError(error, { errorType: 'agent_skill_packs_flag_gate_failure' })
    }
  }

  async function fetchPacks(): Promise<void> {
    loading.value = true
    try {
      packs.value = await listSkillPacks()
      routesAvailable.value = true
    } catch (error) {
      if (error instanceof SkillPacksApiError && error.status === 404) {
        markUnavailable()
        return
      }
      throw error
    } finally {
      loading.value = false
    }
  }

  /** Replaces the pack of the same name, mirroring the create-or-replace route. */
  function upsertPack(pack: SkillPack): void {
    const rest = packs.value.filter((existing) => existing.name !== pack.name)
    packs.value = [...rest, pack].sort((a, b) => a.name.localeCompare(b.name))
  }

  function removePack(name: string): void {
    packs.value = packs.value.filter((pack) => pack.name !== name)
  }

  function markUnavailable(): void {
    routesAvailable.value = false
    packs.value = []
  }

  return {
    packs,
    loading,
    enabled,
    flagsEnabled,
    routesAvailable,
    totalBytes,
    startFlagGate,
    fetchPacks,
    upsertPack,
    removePack,
    markUnavailable
  }
})
