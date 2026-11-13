import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'

import {
  deleteSkillPack as deleteSkillPackApi,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'

export function useSkillPacks() {
  const { t } = useI18n()
  const toast = useToast()
  const store = useSkillPacksStore()

  const operatingPackName = ref<string | null>(null)

  function reportUnexpected(error: unknown, errorType: string) {
    reportError(error, { errorType, surface: 'agent' })
    toast.error(t('g.error'), {
      description:
        error instanceof SkillPacksApiError
          ? error.message
          : t('g.unknownError')
    })
  }

  async function fetchSkillPacks(): Promise<boolean> {
    try {
      return await store.fetchPacks()
    } catch (error) {
      reportUnexpected(error, 'error_fetching_agent_skill_packs')
      return false
    }
  }

  /**
   * Delete 404 means missing pack or disabled gate; re-list to distinguish them.
   */
  async function deleteSkillPack(pack: SkillPack): Promise<boolean> {
    const requestScope = store.scope
    operatingPackName.value = pack.name
    try {
      await deleteSkillPackApi(pack.name)
      store.removePack(pack.name, requestScope)
      return true
    } catch (error) {
      if (!store.isCurrentScope(requestScope)) return false
      if (error instanceof SkillPacksApiError && error.status === 404) {
        store.removePack(pack.name, requestScope)
        const listingApplied = await fetchSkillPacks()
        return (
          listingApplied &&
          store.isCurrentScope(requestScope) &&
          !store.packs.some((existing) => existing.name === pack.name)
        )
      }
      reportUnexpected(error, 'error_deleting_agent_skill_pack')
      return false
    } finally {
      operatingPackName.value = null
    }
  }

  return {
    operatingPackName,
    deleteSkillPack
  }
}
