import { defineAsyncComponent } from 'vue'

import { t } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'
import {
  getImageFilenameFromUrl,
  toFullResolutionUrl
} from '@/utils/hdrFormatUtil'

const HdrViewerContent = defineAsyncComponent(
  () => import('@/components/hdr/HdrViewerContent.vue')
)

export function openHdrViewer(url: string) {
  const fullResUrl = toFullResolutionUrl(url)
  useDialogStore().showDialog({
    key: 'hdr-viewer',
    title: getImageFilenameFromUrl(fullResUrl) ?? t('hdrViewer.title'),
    component: HdrViewerContent,
    props: { imageUrl: fullResUrl },
    dialogComponentProps: {
      renderer: 'reka',
      size: 'full',
      contentClass: 'w-[80vw] h-[80vh] max-h-[80vh]',
      maximizable: true
    }
  })
}
