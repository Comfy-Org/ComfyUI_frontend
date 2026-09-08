import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '@/platform/updates/common/toastStore'

import {
  deleteSkillPack as deleteSkillPackApi,
  SkillPacksApiError
} from '../api/skillsApi'
import { useSkillPacksStore } from '../stores/skillPacksStore'
import type { SkillPack } from '../types'
import { MAX_PACK_COUNT, MAX_TOTAL_BYTES } from '../types'

export function useSkillPacks() {
  const { t } = useI18n()
  const toastStore = useToastStore()
  const store = useSkillPacksStore()
  const { packs, loading, totalBytes } = storeToRefs(store)

  const operatingPackName = ref<string | null>(null)

  const atPackLimit = computed(() => packs.value.length >= MAX_PACK_COUNT)
  const atByteLimit = computed(() => totalBytes.value >= MAX_TOTAL_BYTES)

  function reportUnexpected(error: unknown, context: string) {
    console.error(context, error)
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
      reportUnexpected(error, 'Unexpected error fetching skill packs:')
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
      reportUnexpected(error, 'Unexpected error deleting skill pack:')
    } finally {
      operatingPackName.value = null
    }
  }

  return {
    packs,
    loading,
    totalBytes,
    atPackLimit,
    atByteLimit,
    operatingPackName,
    fetchSkillPacks,
    deleteSkillPack
  }
}
