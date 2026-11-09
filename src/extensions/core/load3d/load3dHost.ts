import type { Load3dHost } from '@comfyorg/viewport3d/load3d/interfaces'

import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

const ROOT_FOLDERS = new Set(['temp', 'output'])

function resolveImageURL(uploadPath: string): string {
  const [subfolder, filename] = Load3dUtils.splitFilePath(uploadPath)
  const url = ROOT_FOLDERS.has(subfolder)
    ? Load3dUtils.getResourceURL('', filename, subfolder)
    : Load3dUtils.getResourceURL(subfolder, filename, 'input')
  return url.startsWith('/api') ? url : '/api' + url
}

export const load3dHost: Load3dHost = {
  fetchApi: (route, init) => api.fetchApi(route, init),
  getPLYEngine: () => useSettingStore().get('Comfy.Load3D.PLYEngine'),
  resolveImageURL
}
