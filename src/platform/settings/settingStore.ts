import { settingStoreSetup } from '@comfyorg/settings-core/settingStore'
import { defineStore } from 'pinia'

import { api } from '@/scripts/api'

export const useSettingStore = defineStore('setting', () =>
  settingStoreSetup(api)
)
