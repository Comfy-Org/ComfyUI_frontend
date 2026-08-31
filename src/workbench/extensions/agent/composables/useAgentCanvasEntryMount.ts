import type { Component, ComputedRef } from 'vue'
import { computed, shallowRef, watch } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { getAgentUiComponentsForDistribution } from '../config/agentDistribution'

interface AgentOnboardingGuideHandle {
  open(): void
}

interface AgentCanvasEntryMount {
  enabled: ComputedRef<boolean>
  CompactAgentComposer: Component | null
  AgentOnboardingGuide: Component | null
  setOnboardingGuideRef: (guide: unknown) => void
  openOnboardingGuide: () => void
}

export function useAgentCanvasEntryMount(): AgentCanvasEntryMount {
  const onboardingGuideRef = shallowRef<AgentOnboardingGuideHandle>()
  let onboardingRequested = false
  const setOnboardingGuideRef = (guide: unknown): void => {
    onboardingGuideRef.value = isAgentOnboardingGuideHandle(guide)
      ? guide
      : undefined
  }
  const openOnboardingGuide = (): void => {
    if (onboardingGuideRef.value !== undefined) {
      onboardingGuideRef.value.open()
      return
    }
    onboardingRequested = true
  }
  watch(onboardingGuideRef, (guide) => {
    if (guide === undefined || !onboardingRequested) return
    onboardingRequested = false
    guide.open()
  })

  const components = getAgentUiComponentsForDistribution()
  if (components === null) {
    return {
      enabled: computed(() => false),
      CompactAgentComposer: null,
      AgentOnboardingGuide: null,
      setOnboardingGuideRef,
      openOnboardingGuide
    }
  }

  const agentPanelStore = useAgentPanelStore()
  return {
    enabled: computed(() => agentPanelStore.enabled),
    CompactAgentComposer: components.CompactAgentComposer,
    AgentOnboardingGuide: components.AgentOnboardingGuide,
    setOnboardingGuideRef,
    openOnboardingGuide
  }
}

function isAgentOnboardingGuideHandle(
  value: unknown
): value is AgentOnboardingGuideHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'open' in value &&
    typeof value.open === 'function'
  )
}
