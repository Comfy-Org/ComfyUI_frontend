import { computed } from 'vue'

import { useBuiltinSkillsStore } from '@/platform/skills/stores/builtinSkillsStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'

export type SkillCatalogStatus = 'loading' | 'empty' | 'failed'
export type BuiltinSkillCatalogStatus = 'loading' | 'failed'

export const SKILL_CATALOG_STATUS_LABELS = {
  loading: 'agent.skillsLoading',
  empty: 'agent.noSkillsYet',
  failed: 'agent.skillsLoadError'
} as const satisfies Record<SkillCatalogStatus, string>

export const BUILTIN_SKILL_CATALOG_STATUS_LABELS = {
  loading: 'agent.comfySkillsLoading',
  failed: 'agent.comfySkillsLoadError'
} as const satisfies Record<BuiltinSkillCatalogStatus, string>

export function useSkillCatalogStatus() {
  const skills = useSkillPacksStore()

  return computed<SkillCatalogStatus | undefined>(() => {
    if (skills.packs.length > 0) return undefined
    if (skills.loading) return skills.catalogConfirmed ? 'empty' : 'loading'
    if (skills.loadFailed) return 'failed'
    return skills.catalogConfirmed ? 'empty' : 'loading'
  })
}

export function useBuiltinSkillCatalogStatus() {
  const builtinSkills = useBuiltinSkillsStore()

  return computed<BuiltinSkillCatalogStatus | undefined>(() => {
    if (!builtinSkills.routesAvailable) return undefined
    if (builtinSkills.visibleSkills.length > 0) return undefined
    if (builtinSkills.loading) {
      return builtinSkills.catalogConfirmed ? undefined : 'loading'
    }
    if (builtinSkills.loadFailed) return 'failed'
    if (builtinSkills.catalogConfirmed) return undefined
    return builtinSkills.catalogRequested ? 'loading' : undefined
  })
}
