import { defineAsyncComponent } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

const Load3dViewerContent = defineAsyncComponent(
  () => import('@/components/load3d/Load3dViewerContent.vue')
)

export function useLoad3dViewerDialog() {
  const dialogStore = useDialogStore()

  function openLoad3dViewer({
    title,
    modelUrl
  }: {
    title: string
    modelUrl: string
  }) {
    dialogStore.showDialog({
      key: 'asset-3d-viewer',
      title,
      component: Load3dViewerContent,
      props: {
        modelUrl
      },
      dialogComponentProps: {
        style: 'width: 80vw; height: 80vh;',
        maximizable: true
      }
    })
  }

  return { openLoad3dViewer }
}
