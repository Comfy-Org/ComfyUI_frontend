import { defineSettingStore } from '@comfyorg/settings-core/settingStore'

import { api } from '@/scripts/api'

export const useSettingStore = defineSettingStore(api)
