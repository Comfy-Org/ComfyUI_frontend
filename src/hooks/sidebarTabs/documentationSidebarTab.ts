import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import DocumentationSidebarTab from '@/components/sidebar/tabs/DocumentationSidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useDocumentationSidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()
  const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
  return {
    id: 'documentation',
    icon: 'mdi mdi-help',
    title: t('sideToolbar.documentation'),
    tooltip: t('sideToolbar.documentation'),
    component: markRaw(DocumentationSidebarTab),
    type: 'vue'
  }
}
