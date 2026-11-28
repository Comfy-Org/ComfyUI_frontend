import { computed } from 'vue'

import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'

export type SkillCatalogStatus = 'loading' | 'empty' | 'failed' | 'unavailable'

export const SKILL_CATALOG_STATUS_LABELS = {
  loading: 'agent.skillsLoading',
  empty: 'agent.noSkillsYet',
  failed: 'agent.skillsLoadError',
  unavailable: 'agent.skillsUnavailable'
} as const satisfies Record<SkillCatalogStatus, string>

export function useSkillCatalogStatus() {
  const skills = useSkillPacksStore()

  return computed<SkillCatalogStatus | undefined>(() => {
    if (skills.packs.length > 0) return undefined
    if (skills.loading) return skills.catalogConfirmed ? 'empty' : 'loading'
    if (skills.loadFailed) return 'failed'
    if (skills.catalogUnavailable) return 'unavailable'
    return skills.catalogConfirmed ? 'empty' : 'loading'
  })
}
