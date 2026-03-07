import { isValidUrl } from '@comfyorg/shared-frontend-utils/formatUtil'

import { electronAPI } from './envUtil'

export const checkMirrorReachable = async (mirror: string) => {
  return (
    isValidUrl(mirror) && (await electronAPI().NetWork.canAccessUrl(mirror))
  )
}
