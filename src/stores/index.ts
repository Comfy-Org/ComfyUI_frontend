import { createPinia } from 'pinia'
import { useMainStore } from './mainStore'
import { useSettingStore } from './settingStore'
import { useNodeDefStore } from './nodeDefStore'

export const pinia = createPinia()
export { storeToRefs } from 'pinia'
export { useMainStore } from './mainStore'
export { useSettingStore } from './settingStore'
export { useNodeDefStore } from './nodeDefStore'

export const resetAllStores = () => {
  useMainStore().reset()
}

export const isBrowser = typeof window !== 'undefined'
export const isDev = process.env.NODE_ENV === 'development'
