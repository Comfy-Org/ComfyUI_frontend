import type { assetService } from '@/platform/assets/services/assetService'
import type {
  AssetDownloadWsMessage,
  AssetExportWsMessage
} from '@/platform/remote/comfyui/execution/types'

export const runningDownload: AssetDownloadWsMessage = {
  task_id: '11111111-1111-4111-8111-111111111111',
  asset_id: 'missing-model',
  asset_name: 'missing-model.safetensors',
  bytes_total: 1000,
  bytes_downloaded: 370,
  progress: 0.37,
  status: 'running'
}

export const lateDownload: AssetDownloadWsMessage = {
  ...runningDownload,
  asset_name: 'late-model.safetensors',
  bytes_downloaded: 1000,
  progress: 1,
  status: 'completed'
}

export const runningExport: AssetExportWsMessage = {
  task_id: '22222222-2222-4222-8222-222222222222',
  export_name: 'partial-export.zip',
  assets_total: 7,
  assets_attempted: 2,
  assets_failed: 1,
  bytes_total: 1000,
  bytes_processed: 370,
  progress: 0.37,
  status: 'running'
}

export const lateExport: AssetExportWsMessage = {
  ...runningExport,
  export_name: 'late.zip',
  assets_attempted: 7,
  assets_failed: 0,
  bytes_processed: 1000,
  progress: 1,
  status: 'completed'
}

export const exportDownloadResponse: Awaited<
  ReturnType<typeof assetService.getExportDownloadUrl>
> = { url: 'https://example.test/late.zip' }
