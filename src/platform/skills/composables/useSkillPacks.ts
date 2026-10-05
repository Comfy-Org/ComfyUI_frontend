import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

import {
  deleteSkillPack as deleteSkillPackApi,
  SkillPacksApiError
} from '../api/skillsApi'
import { useSkillPacksStore } from '../stores/skillPacksStore'
import type { SkillPack } from '../types'

export function useSkillPacks() {
  const { t } = useI18n()
  const toastStore = useToastStore()
  const store = useSkillPacksStore()
  const { packs, loading, hasLoaded } = storeToRefs(store)

  const operatingPackName = ref<string | null>(null)

  function reportUnexpected(error: unknown, errorType: string) {
    reportError(error, { errorType, surface: 'agent' })
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail:
        error instanceof SkillPacksApiError
          ? error.message
          : t('g.unknownError')
    })
  }

  async function fetchSkillPacks() {
    try {
      await store.fetchPacks()
    } catch (error) {
      reportUnexpected(error, 'error_fetching_agent_skill_packs')
    }
  }

  /**
   * Delete 404 means missing pack or disabled gate; re-list to distinguish them.
   */
  async function deleteSkillPack(pack: SkillPack) {
    operatingPackName.value = pack.name
    try {
      await deleteSkillPackApi(pack.name)
      store.removePack(pack.name)
    } catch (error) {
      if (error instanceof SkillPacksApiError && error.status === 404) {
        store.removePack(pack.name)
        await fetchSkillPacks()
        return
      }
      reportUnexpected(error, 'error_deleting_agent_skill_pack')
    } finally {
      operatingPackName.value = null
    }
  }

  return {
    packs,
    loading,
    hasLoaded,
    operatingPackName,
    fetchSkillPacks,
    deleteSkillPack
  }
}
