import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { st } from '@/i18n'
import { useExecutionStore } from '@/stores/executionStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

export function useCurrentNodeName() {
  const { t } = useI18n()
  const executionStore = useExecutionStore()

  const currentNodeName = computed(() => {
    const node = executionStore.executingNode
    if (!node) return t('g.emDash')
    const title = (node.title ?? '').toString().trim()
    if (title) return title
    const nodeType = (node.type ?? '').toString().trim() || t('g.untitled')
    const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
    return st(key, nodeType)
  })

  return { currentNodeName }
}
