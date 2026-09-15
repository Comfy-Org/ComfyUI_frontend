import { defineStore } from 'pinia'

export type AutoQueueMode =
  | 'disabled'
  | 'change'
  | 'instant-idle'
  | 'instant-running'

export function isInstantMode(
  mode: AutoQueueMode
): mode is 'instant-idle' | 'instant-running' {
  return mode === 'instant-idle' || mode === 'instant-running'
}

export function isInstantRunningMode(
  mode: AutoQueueMode
): mode is 'instant-running' {
  return mode === 'instant-running'
}

export const useQueueSettingsStore = defineStore('queueSettingsStore', {
  state: () => ({
    mode: 'disabled' as AutoQueueMode,
    batchCount: 1
  })
})
