import { useI18n } from 'vue-i18n'

import AuthorDashboard from '@/platform/marketplace/components/AuthorDashboard.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'author-marketplace-dashboard'

export function useAuthorDashboardDialog() {
  const dialogStore = useDialogStore()
  const { t } = useI18n()

  function show() {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      title: t('marketplace.authorDashboard'),
      component: AuthorDashboard,
      dialogComponentProps: {
        pt: {
          header: 'py-0! pl-0!',
          content: 'p-0! overflow-y-hidden!'
        }
      }
    })
  }

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { show, hide }
}
