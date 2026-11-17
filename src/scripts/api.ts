import { ComfyApi as ComfyApiClient } from '@comfyorg/api-client/ComfyApi'

import { createApi } from '@/scripts/createApi'

export const ComfyApi = ComfyApiClient

export const api = createApi()
