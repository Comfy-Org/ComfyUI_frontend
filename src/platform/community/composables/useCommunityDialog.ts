import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import CommunityDialog from '../components/CommunityDialog.vue'

export function useCommunityDialog() {
  const service = useDialogService()
  const store = useDialogStore()
  const key = 'community'

  function hide() {
    store.closeDialog({ key })
  }

  function show(section: 'packs' | 'workflows' = 'packs') {
    service.showLayoutDialog({
      key,
      component: CommunityDialog,
      props: { initialSection: section, onClose: hide },
      dialogComponentProps: {
        renderer: 'reka',
        modal: true,
        size: 'full',
        contentClass:
          'h-[85dvh] w-[95vw] max-w-[1724px] overflow-hidden rounded-2xl sm:max-w-[1724px]'
      }
    })
  }

  return { show, hide }
}
