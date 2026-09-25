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
  const { packs, loading } = storeToRefs(store)

  const operatingPackName = ref<string | null>(null)

  function reportUnexpected(error: unknown, errorType: string) {
    reportError(error, { errorType })
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
   * A 404 here is ambiguous by contract — the pack is already gone, or the
   * cohort gate is off — so drop the row either way and let the follow-up list
   * request settle which it was.
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
    operatingPackName,
    fetchSkillPacks,
    deleteSkillPack
  }
}
