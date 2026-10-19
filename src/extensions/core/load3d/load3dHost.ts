import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import type { Load3dHost } from './interfaces'

export const load3dHost: Load3dHost = {
  fetchApi: (route, init) => api.fetchApi(route, init),
  getPLYEngine: () => useSettingStore().get('Comfy.Load3D.PLYEngine')
}
