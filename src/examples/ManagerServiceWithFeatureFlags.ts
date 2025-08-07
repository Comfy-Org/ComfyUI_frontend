/* eslint-disable no-console */
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { SelectedVersion, ManagerDatabaseSource, ManagerChannel } from '@/types/comfyManagerTypes'

/**
 * Example of how to use feature flags with the ComfyUI Manager Service
 *
 * This demonstrates how to conditionally use different API versions or features
 * based on server capabilities.
 */
export function useEnhancedManagerService() {
  const { flags, featureFlag } = useFeatureFlags()
  const managerService = useComfyManagerService()

  // Get reactive references to specific manager features
  const supportsV4 = flags.supportsManagerV4
  const supportsBatchOperations = featureFlag(
    'extension.manager.supports_batch_operations',
    false
  )
  const maxBatchSize = featureFlag('extension.manager.max_batch_size', 10)

  /**
   * Install multiple packs with batch support if available
   */
  async function installMultiplePacks(packIds: string[]) {
    if (supportsV4 && supportsBatchOperations.value) {
      // Use v4 batch API if available
      console.log(
        `Installing ${packIds.length} packs in batch (max size: ${maxBatchSize.value})`
      )

      // Split into batches if needed
      const batches = []
      for (let i = 0; i < packIds.length; i += maxBatchSize.value) {
        batches.push(packIds.slice(i, i + maxBatchSize.value))
      }

      // Install each batch
      for (const batch of batches) {
        // In a real implementation, this would call a batch API endpoint
        console.log(`Installing batch: ${batch.join(', ')}`)
        // await managerService.installPackBatch(batch)
      }
    } else {
      // Fall back to installing one by one
      console.log(
        'Batch operations not supported, installing packs individually'
      )
      for (const packId of packIds) {
        await managerService.installPack({
          id: packId,
          selected_version: SelectedVersion.LATEST,
          repository: '',
          mode: ManagerDatabaseSource.REMOTE,
          channel: ManagerChannel.DEFAULT,
          version: ''
        })
      }
    }
  }

  /**
   * Get enhanced pack information if v4 is supported
   */
  async function getPackInfo(packId: string) {
    if (supportsV4) {
      // V4 provides additional metadata
      console.log(`Getting enhanced pack info for ${packId}`)
      // const info = await managerService.getPackInfoV4(packId)
      // return { ...info, enhanced: true }
    } else {
      // Use legacy API
      console.log(`Getting basic pack info for ${packId}`)
      // return await managerService.getPackInfo(packId)
    }
  }

  /**
   * Example of using feature flags for UI decisions
   */
  function getAvailableActions() {
    const actions = ['install', 'uninstall', 'update', 'disable']

    if (supportsV4) {
      actions.push('rollback', 'pin-version')
    }

    if (supportsBatchOperations.value) {
      actions.push('batch-update', 'batch-install')
    }

    return actions
  }

  return {
    // Expose original service methods
    ...managerService,

    // Enhanced methods that use feature flags
    installMultiplePacks,
    getPackInfo,
    getAvailableActions,

    // Expose feature flags for UI components
    features: {
      supportsV4,
      supportsBatchOperations,
      maxBatchSize
    }
  }
}
