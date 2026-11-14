import { computed } from 'vue'

import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'

export type SkillCatalogStatus = 'loading' | 'empty' | 'failed'

export const SKILL_CATALOG_STATUS_LABELS = {
  loading: 'agent.skillsLoading',
  empty: 'agent.noSkillsYet',
  failed: 'agent.skillsLoadError'
} as const satisfies Record<SkillCatalogStatus, string>

export function useSkillCatalogStatus() {
  const skills = useSkillPacksStore()

  return computed<SkillCatalogStatus | undefined>(() => {
    if (skills.packs.length > 0) return undefined
    if (skills.loading) return skills.catalogConfirmed ? 'empty' : 'loading'
    return skills.catalogConfirmed && !skills.loadFailed ? 'empty' : 'failed'
  })
}
