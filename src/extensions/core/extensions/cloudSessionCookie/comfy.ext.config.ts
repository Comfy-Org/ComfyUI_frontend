import { defineComfyExtConfig } from '@/extensions/utils'

export default defineComfyExtConfig({
  name: 'Comfy.Cloud.SessionCookie',
  activationEvents: ['*'],
  comfyCloud: true,
})
