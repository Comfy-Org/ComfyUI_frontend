import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ModelImportProgressToast } from '@e2e/fixtures/components/ModelImportProgressToast'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

interface ModelImportProgressFixtures {
  comfyPage: ComfyPage
  modelImportProgress: ModelImportProgressToast
}

export const modelImportProgressFixture =
  base.extend<ModelImportProgressFixtures>({
    modelImportProgress: async ({ comfyPage, page }, use) => {
      const completed: AssetDownloadWsMessage = {
        task_id: 'completed-model-import',
        asset_name: 'completed-model.safetensors',
        asset_id: 'completed-model',
        bytes_total: 1000,
        bytes_downloaded: 1000,
        progress: 100,
        status: 'completed'
      }
      const failed: AssetDownloadWsMessage = {
        task_id: 'failed-model-import',
        asset_name: 'failed-model.safetensors',
        bytes_total: 1000,
        bytes_downloaded: 400,
        progress: 40,
        status: 'failed',
        error: 'Source server error'
      }

      await comfyPage.assets.dispatchDownload(completed)
      await comfyPage.assets.dispatchDownload(failed)
      await use(new ModelImportProgressToast(page))
    }
  })
