import { useDockedToast } from '@/components/ui/toast/useDockedToast'
import AssetExportProgressDialog from '@/platform/assets/components/AssetExportProgressDialog.vue'
import ModelImportProgressDialog from '@/platform/assets/components/ModelImportProgressDialog.vue'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useAssetExportStore } from '@/stores/assetExportStore'

export function useAssetProgressToasts() {
  const assetDownloadStore = useAssetDownloadStore()
  const assetExportStore = useAssetExportStore()
  useDockedToast(
    () => assetDownloadStore.hasDownloads,
    ModelImportProgressDialog
  )
  useDockedToast(() => assetExportStore.hasExports, AssetExportProgressDialog)
}
