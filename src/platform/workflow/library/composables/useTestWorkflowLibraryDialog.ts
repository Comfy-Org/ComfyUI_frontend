import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import TestWorkflowLibraryDialog from '../components/TestWorkflowLibraryDialog.vue'

const key = 'test-workflow-library'

export function useTestWorkflowLibraryDialog() {
  const service = useDialogService()
  const store = useDialogStore()
  function show() {
    service.showLayoutDialog({
      key,
      component: TestWorkflowLibraryDialog,
      props: { onClose: () => store.closeDialog({ key }) },
      dialogComponentProps: {
        size: 'full',
        contentClass:
          'h-[80vh] w-[90vw] max-w-[1400px] overflow-hidden rounded-2xl sm:max-w-[1400px]'
      }
    })
  }
  return { show }
}
