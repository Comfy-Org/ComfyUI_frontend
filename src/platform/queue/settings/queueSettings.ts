import type { SettingParams } from '@comfyorg/settings-core/types'

import { isNightly } from '@/platform/distribution/types'

export const QUEUE_SETTINGS: SettingParams[] = [
  {
    id: 'Comfy.QueueButton.BatchCountLimit',
    name: 'Batch count limit',
    tooltip:
      'The maximum number of tasks added to the queue at one button click',
    type: 'number',
    defaultValue: 100,
    versionAdded: '1.3.5'
  },
  {
    id: 'Comfy.Queue.MaxHistoryItems',
    name: 'Queue history size',
    tooltip: 'The maximum number of tasks that show in the queue history.',
    type: 'slider',
    attrs: {
      min: 2,
      max: 256,
      step: 2
    },
    defaultValue: 64,
    versionAdded: '1.4.12'
  },
  {
    id: 'Comfy.Queue.History.Expanded',
    name: 'Queue history expanded',
    type: 'hidden',
    defaultValue: false,
    versionAdded: '1.37.0'
  },
  {
    id: 'Comfy.Execution.PreviewMethod',
    category: ['Comfy', 'Execution', 'PreviewMethod'],
    name: 'Live preview method',
    tooltip:
      'Live preview method during image generation. "default" uses the server CLI setting.',
    type: 'combo',
    options: ['default', 'none', 'auto', 'latent2rgb', 'taesd'],
    defaultValue: 'default',
    versionAdded: '1.36.0'
  },
  {
    id: 'Comfy.Queue.QPOV2',
    category: ['Comfy', 'Queue', 'Layout'],
    name: 'Docked job history/queue panel',
    type: 'boolean',
    tooltip:
      'Replaces the floating job queue panel with an equivalent job queue embedded in the job history side panel. You can disable this to return to the floating panel layout.',
    defaultValue: isNightly,
    experimental: true
  },
  {
    id: 'Comfy.Queue.ShowRunProgressBar',
    name: 'Show run progress bar',
    type: 'hidden',
    defaultValue: true,
    versionAdded: '1.41.3'
  }
]
