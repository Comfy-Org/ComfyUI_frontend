import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'

export function workspaceApiUrl(route: string): string {
  return isCloud ? api.apiURL(route) : `${getComfyCloudBaseUrl()}/api${route}`
}
