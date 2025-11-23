import MissingNodesContent from '@/components/dialog/content/MissingNodesContent.vue'
import MissingNodesFooter from '@/components/dialog/content/MissingNodesFooter.vue'
import MissingNodesHeader from '@/components/dialog/content/MissingNodesHeader.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComponentProps } from 'vue-component-type-helpers'

const DIALOG_KEY = 'global-missing-nodes'

export const useMissingNodesDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(props: ComponentProps<typeof MissingNodesContent>) {
    dialogService.showSmallDialog({
      key: DIALOG_KEY,
      headerComponent: MissingNodesHeader,
      footerComponent: MissingNodesFooter,
      component: MissingNodesContent,
      props
    })
  }

  return { show, hide }
}
