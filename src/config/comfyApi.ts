import { isProductionEnvironment } from './environment'

export const COMFY_API_BASE_URL = isProductionEnvironment()
  ? 'https://api.comfy.org'
  : 'https://stagingapi.comfy.org'

export const COMFY_PLATFORM_BASE_URL = isProductionEnvironment()
  ? 'https://platform.comfy.org'
  : 'https://stagingplatform.comfy.org'
